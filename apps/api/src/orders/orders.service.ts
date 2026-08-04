import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AgentStatus, Prisma, ProductStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../operations/idempotency.service';
import { OutboxService } from '../operations/outbox.service';
import { OrderContactProtectionService } from './order-contact-protection.service';

const PRICE_VALIDITY_MS = 15 * 60 * 1_000;
const AUTHORIZATION_WINDOW_MS = 180 * 1_000;
interface CreateWebOrderInput {
  webSalesId: string;
  productId: string;
  quantity: number;
  deliveryPhone: string;
  deliveryPhoneConfirmation: string;
  deliveryEmail?: string;
  deliveryEmailConfirmation?: string;
  idempotencyKey: string;
}

interface LockedVoucher {
  id: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: OrderContactProtectionService,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: OutboxService,
  ) {}

  async createWebOrder(input: CreateWebOrderInput) {
    const isHex = /^[a-f0-9]{24}$/i.test(input.webSalesId);
    const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(input.webSalesId);
    if (!isHex && !isSlug) {
      throw new NotFoundException('Sales channel not found');
    }
    const deliveryPhone = this.contacts.protectPhone(
      input.deliveryPhone,
      'delivery',
    );
    if (
      deliveryPhone.normalized !==
      this.contacts.normalizePhone(input.deliveryPhoneConfirmation)
    ) {
      throw new BadRequestException('Delivery phone numbers must match');
    }
    const deliveryEmail = input.deliveryEmail
      ? this.contacts.protectEmail(input.deliveryEmail, 'delivery')
      : null;
    if (
      deliveryEmail &&
      deliveryEmail.normalized !==
        this.contacts.normalizeEmail(input.deliveryEmailConfirmation ?? '')
    ) {
      throw new BadRequestException('Delivery email addresses must match');
    }
    const syntheticEmail = this.contacts.syntheticEmail(
      deliveryPhone.normalized,
    );
    const publicReference = randomReference('DRF', 12);
    const providerReference = randomReference('DORAF', 18);
    const now = new Date();
    const priceExpiresAt = new Date(now.getTime() + PRICE_VALIDITY_MS);
    const authorizationExpiresAt = new Date(
      now.getTime() + AUTHORIZATION_WINDOW_MS,
    );

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const idempotency = await this.idempotency.acquireInTransaction(
            transaction,
            {
              scope: `checkout:web:${input.webSalesId}`,
              key: input.idempotencyKey,
              operation: 'CREATE_WEB_ORDER',
              requestFingerprint: requestFingerprint({
                productId: input.productId,
                quantity: input.quantity,
                deliveryPhone: deliveryPhone.normalized,
                deliveryEmail: deliveryEmail?.normalized ?? null,
              }),
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
            },
          );
          if (!idempotency.acquired) {
            return this.getCreatedOrder(
              transaction,
              idempotency.record.outcomeReference!,
              true,
            );
          }

          const agent = await transaction.agent.findFirst({
            where: isHex
              ? { OR: [{ webSalesId: input.webSalesId }, { slug: input.webSalesId }] }
              : { slug: input.webSalesId },
            select: {
              id: true,
              tenantId: true,
              status: true,
              webSalesId: true,
              slug: true,
              productPrices: {
                where: { productId: input.productId },
                select: {
                  retailPriceMinor: true,
                  currency: true,
                  product: {
                    select: { id: true, name: true, status: true },
                  },
                },
              },
            },
          });
          if (!agent || agent.status !== AgentStatus.ACTIVE) {
            throw new NotFoundException('Sales channel not found');
          }
          const configuredPrice = agent.productPrices[0];
          if (
            !configuredPrice ||
            configuredPrice.product.status !== ProductStatus.ACTIVE
          ) {
            throw new ConflictException('This checker is not available');
          }

          const [policy, override] = await Promise.all([
            transaction.productPricingPolicy.findFirst({
              where: {
                productId: input.productId,
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
              orderBy: { effectiveFrom: 'desc' },
            }),
            transaction.agentPricingOverride.findFirst({
              where: {
                agentId: agent.id,
                productId: input.productId,
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
              orderBy: { effectiveFrom: 'desc' },
            }),
          ]);
          if (!policy) {
            throw new ConflictException('This checker is not available');
          }
          const baseUnitPriceMinor =
            override?.basePriceMinor ?? policy.basePriceMinor;
          const retailUnitPriceMinor = configuredPrice.retailPriceMinor;
          if (retailUnitPriceMinor < baseUnitPriceMinor) {
            throw new ConflictException('This checker price is unavailable');
          }
          const agentProfitUnitMinor =
            retailUnitPriceMinor - baseUnitPriceMinor;
          const quantity = BigInt(input.quantity);

          await this.releaseExpiredUninitializedReservations(
            transaction,
            input.productId,
            now,
          );

          const vouchers = await transaction.$queryRaw<LockedVoucher[]>`
            SELECT voucher.id
            FROM voucher
            JOIN inventory_batch
              ON inventory_batch.id = voucher.batch_id
            WHERE voucher.product_id = ${input.productId}::uuid
              AND voucher.availability = 'AVAILABLE'
            ORDER BY inventory_batch.acquisition_date ASC,
                     inventory_batch.imported_at ASC,
                     voucher.created_at ASC,
                     voucher.id ASC
            FOR UPDATE OF voucher SKIP LOCKED
            LIMIT ${input.quantity}
          `;
          if (vouchers.length !== input.quantity) {
            throw new ConflictException(
              'The requested quantity is not available right now',
            );
          }

          const order = await transaction.order.create({
            data: {
              publicReference,
              tenantId: agent.tenantId,
              agentId: agent.id,
              channelType: 'WEB',
              channelIdSnapshot: agent.slug || agent.webSalesId,
              productId: input.productId,
              quantity: input.quantity,
              currency: configuredPrice.currency,
              baseTotalMinor: baseUnitPriceMinor * quantity,
              retailTotalMinor: retailUnitPriceMinor * quantity,
              agentProfitTotalMinor: agentProfitUnitMinor * quantity,
              deliveryPhoneCiphertext: prismaBytes(deliveryPhone.ciphertext),
              deliveryPhoneFingerprint: prismaBytes(deliveryPhone.fingerprint),
              deliveryPhoneMask: deliveryPhone.mask,
              deliveryEmailCiphertext: deliveryEmail
                ? prismaBytes(deliveryEmail.ciphertext)
                : undefined,
              deliveryEmailFingerprint: deliveryEmail
                ? prismaBytes(deliveryEmail.fingerprint)
                : undefined,
              deliveryEmailMask: deliveryEmail?.mask,
              contactEncryptionKeyId: deliveryPhone.encryptionKeyId,
              contactFormatVersion: deliveryPhone.formatVersion,
              priceExpiresAt,
              items: {
                create: Array.from({ length: input.quantity }, (_, index) => ({
                  position: index + 1,
                  productId: input.productId,
                  baseUnitPriceMinor,
                  retailUnitPriceMinor,
                  agentProfitUnitMinor,
                })),
              },
            },
          });
          const attempt = await transaction.paymentAttempt.create({
            data: {
              orderId: order.id,
              attemptNumber: 1,
              providerReference,
              syntheticEmailCiphertext: prismaBytes(syntheticEmail.ciphertext),
              syntheticEmailMask: syntheticEmail.mask,
              expectedAmountMinor: retailUnitPriceMinor * quantity,
              currency: configuredPrice.currency,
              authorizationExpiresAt,
            },
          });
          const reservation = await transaction.inventoryReservation.create({
            data: {
              orderId: order.id,
              paymentAttemptId: attempt.id,
              productId: input.productId,
              expiresAt: authorizationExpiresAt,
            },
          });
          await transaction.inventoryReservationItem.createMany({
            data: vouchers.map((voucher) => ({
              reservationId: reservation.id,
              voucherId: voucher.id,
            })),
          });
          const reserved = await transaction.voucher.updateMany({
            where: {
              id: { in: vouchers.map((voucher) => voucher.id) },
              productId: input.productId,
              availability: 'AVAILABLE',
            },
            data: { availability: 'RESERVED', version: { increment: 1 } },
          });
          if (reserved.count !== input.quantity) {
            throw new ConflictException(
              'The requested quantity is not available right now',
            );
          }
          await transaction.inventoryEvent.createMany({
            data: vouchers.map((voucher) => ({
              voucherId: voucher.id,
              eventType: 'VOUCHER_RESERVED',
              previousAvailability: 'AVAILABLE',
              resultingAvailability: 'RESERVED',
              sourceType: 'PAYMENT_ATTEMPT',
              sourceId: attempt.id,
              safeMetadata: {
                orderId: order.id,
                reservationId: reservation.id,
              },
            })),
          });
          await this.outbox.enqueue(transaction, {
            eventType: 'PAYMENT_INITIALIZATION_REQUESTED',
            aggregateType: 'PAYMENT_ATTEMPT',
            aggregateId: attempt.id,
            aggregateVersion: 1,
            payload: { paymentAttemptId: attempt.id },
          });
          await this.outbox.enqueue(transaction, {
            eventType: 'RESERVATION_EXPIRY_DUE',
            aggregateType: 'INVENTORY_RESERVATION',
            aggregateId: reservation.id,
            aggregateVersion: 1,
            availableAt: authorizationExpiresAt,
            payload: { reservationId: reservation.id },
          });
          await this.idempotency.completeInTransaction(
            transaction,
            idempotency.record.id,
            order.id,
          );
          return this.serializeCreatedOrder(
            order,
            configuredPrice.product.name,
            attempt,
            false,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async getCreatedOrder(
    transaction: Prisma.TransactionClient,
    orderId: string,
    replayed: boolean,
  ) {
    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        product: { select: { name: true } },
        paymentAttempts: {
          where: { attemptNumber: 1 },
          take: 1,
        },
      },
    });
    return this.serializeCreatedOrder(
      order,
      order.product.name,
      order.paymentAttempts[0],
      replayed,
    );
  }

  private async releaseExpiredUninitializedReservations(
    transaction: Prisma.TransactionClient,
    productId: string,
    now: Date,
  ) {
    const expired = await transaction.inventoryReservation.findMany({
      where: {
        productId,
        state: 'ACTIVE',
        expiresAt: { lte: now },
        paymentAttempt: { state: 'CREATED' },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        paymentAttemptId: true,
        items: { select: { voucherId: true } },
      },
    });
    for (const reservation of expired) {
      const released = await transaction.inventoryReservation.updateMany({
        where: { id: reservation.id, state: 'ACTIVE' },
        data: { state: 'RELEASED', version: { increment: 1 } },
      });
      if (released.count !== 1) continue;
      await transaction.paymentAttempt.updateMany({
        where: { id: reservation.paymentAttemptId, state: 'CREATED' },
        data: { state: 'ABANDONED', version: { increment: 1 } },
      });
      const voucherIds = reservation.items.map((item) => item.voucherId);
      await transaction.voucher.updateMany({
        where: { id: { in: voucherIds }, availability: 'RESERVED' },
        data: { availability: 'AVAILABLE', version: { increment: 1 } },
      });
      await transaction.inventoryEvent.createMany({
        data: voucherIds.map((voucherId) => ({
          voucherId,
          eventType: 'RESERVATION_RELEASED',
          previousAvailability: 'RESERVED',
          resultingAvailability: 'AVAILABLE',
          sourceType: 'RESERVATION_EXPIRY',
          sourceId: reservation.id,
          safeMetadata: { reservationId: reservation.id },
        })),
        skipDuplicates: true,
      });
    }
  }

  private serializeCreatedOrder(
    order: {
      id: string;
      publicReference: string;
      quantity: number;
      currency: string;
      retailTotalMinor: bigint;
      deliveryPhoneMask: string;
      deliveryEmailMask: string | null;
      priceExpiresAt: Date;
    },
    productName: string,
    attempt: {
      providerReference: string;
      state: string;
      authorizationExpiresAt: Date;
    },
    replayed: boolean,
  ) {
    return {
      orderReference: order.publicReference,
      productName,
      quantity: order.quantity,
      currency: order.currency.trim(),
      totalMinor: Number(order.retailTotalMinor),
      deliveryPhoneMask: order.deliveryPhoneMask,
      deliveryEmailMask: order.deliveryEmailMask,
      priceExpiresAt: order.priceExpiresAt.toISOString(),
      payment: {
        reference: attempt.providerReference,
        state: attempt.state,
        authorizationExpiresAt: attempt.authorizationExpiresAt.toISOString(),
      },
      replayed,
    };
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          attempt === 3 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034'
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('Checkout could not be completed');
  }
}

function randomReference(prefix: string, bytes: number): string {
  return `${prefix}-${randomBytes(bytes).toString('hex')}`;
}

function requestFingerprint(value: Record<string, unknown>): Buffer {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest();
}

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}

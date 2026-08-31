import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  AgentStatus,
  DeliveryChannel,
  DeliveryMessageState,
  Prisma,
  ProductStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CloudTasksOutboxDispatcher } from '../operations/cloud-tasks-outbox.dispatcher';
import { IdempotencyService } from '../operations/idempotency.service';
import { OutboxService } from '../operations/outbox.service';
import { CheckoutAccessTokenService } from './checkout-access-token.service';
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

interface RetryWebOrderInput {
  webSalesId: string;
  orderReference: string;
  checkoutAccessToken?: string;
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
    private readonly checkoutAccess: CheckoutAccessTokenService,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: OutboxService,
    @Optional() private readonly outboxDispatcher?: CloudTasksOutboxDispatcher,
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
    if (!input.deliveryEmail && input.deliveryEmailConfirmation) {
      throw new BadRequestException(
        'Delivery email is required when confirming an email address',
      );
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
    const providerReference = randomReference('DASHCHECKER', 18);
    const now = new Date();
    const priceExpiresAt = new Date(now.getTime() + PRICE_VALIDITY_MS);
    const authorizationExpiresAt = new Date(
      now.getTime() + AUTHORIZATION_WINDOW_MS,
    );

    const __orderResult = await this.withSerializableRetry(() =>
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
            where: {
              OR: [
                { webSalesId: input.webSalesId },
                { slug: input.webSalesId },
              ],
            },
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
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __orderResult;
  }

  async retryWebOrder(input: RetryWebOrderInput) {
    const orderReference = input.orderReference.trim();
    if (
      !this.checkoutAccess.matches(orderReference, input.checkoutAccessToken)
    ) {
      throw new ForbiddenException('This checkout session has expired');
    }

    const isHex = /^[a-f0-9]{24}$/i.test(input.webSalesId);
    const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(input.webSalesId);
    if (!isHex && !isSlug) {
      throw new NotFoundException('Sales channel not found');
    }

    const providerReference = randomReference('DASHCHECKER', 18);
    const now = new Date();
    const authorizationExpiresAt = new Date(
      now.getTime() + AUTHORIZATION_WINDOW_MS,
    );

    const __orderResult = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const idempotency = await this.idempotency.acquireInTransaction(
            transaction,
            {
              scope: `checkout:web:${input.webSalesId}:retry:${orderReference}`,
              key: input.idempotencyKey,
              operation: 'RETRY_WEB_ORDER',
              requestFingerprint: requestFingerprint({ orderReference }),
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

          const channelAgent = await transaction.agent.findFirst({
            where: {
              OR: [
                { webSalesId: input.webSalesId },
                { slug: input.webSalesId },
              ],
              status: AgentStatus.ACTIVE,
            },
            select: { id: true, webSalesId: true, slug: true },
          });
          if (!channelAgent) {
            throw new NotFoundException('Sales channel not found');
          }
          const channelSnapshots = [
            input.webSalesId,
            channelAgent.webSalesId,
            channelAgent.slug,
          ].filter((value): value is string => Boolean(value));
          const order = await transaction.order.findFirst({
            where: {
              publicReference: orderReference,
              agentId: channelAgent.id,
              channelIdSnapshot: { in: channelSnapshots },
            },
            include: {
              product: { select: { name: true } },
              paymentAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
              },
            },
          });
          if (!order) throw new NotFoundException('Order not found');
          if (order.paymentState !== 'UNPAID') {
            throw new ConflictException('This order has already been paid');
          }
          if (now >= order.priceExpiresAt) {
            throw new ConflictException(
              'This order price has expired. Please start a new checkout.',
            );
          }

          const previousAttempt = order.paymentAttempts[0];
          if (
            !previousAttempt ||
            !['FAILED', 'ABANDONED'].includes(previousAttempt.state)
          ) {
            throw new ConflictException(
              'Finish or wait for the current payment attempt before retrying',
            );
          }
          if (previousAttempt.attemptNumber >= 3) {
            throw new ConflictException(
              'The maximum number of payment attempts has been reached',
            );
          }

          await this.releaseExpiredUninitializedReservations(
            transaction,
            order.productId,
            now,
          );
          const vouchers = await transaction.$queryRaw<LockedVoucher[]>`
            SELECT voucher.id
            FROM voucher
            JOIN inventory_batch
              ON inventory_batch.id = voucher.batch_id
            WHERE voucher.product_id = ${order.productId}::uuid
              AND voucher.availability = 'AVAILABLE'
            ORDER BY inventory_batch.acquisition_date ASC,
                     inventory_batch.imported_at ASC,
                     voucher.created_at ASC,
                     voucher.id ASC
            FOR UPDATE OF voucher SKIP LOCKED
            LIMIT ${order.quantity}
          `;
          if (vouchers.length !== order.quantity) {
            throw new ConflictException(
              'The requested quantity is not available right now',
            );
          }

          const attempt = await transaction.paymentAttempt.create({
            data: {
              orderId: order.id,
              attemptNumber: previousAttempt.attemptNumber + 1,
              providerReference,
              syntheticEmailCiphertext: prismaBytes(
                previousAttempt.syntheticEmailCiphertext,
              ),
              syntheticEmailMask: previousAttempt.syntheticEmailMask,
              expectedAmountMinor: order.retailTotalMinor,
              currency: order.currency,
              authorizationExpiresAt,
            },
          });
          const reservation = await transaction.inventoryReservation.create({
            data: {
              orderId: order.id,
              paymentAttemptId: attempt.id,
              productId: order.productId,
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
              productId: order.productId,
              availability: 'AVAILABLE',
            },
            data: { availability: 'RESERVED', version: { increment: 1 } },
          });
          if (reserved.count !== order.quantity) {
            throw new ConflictException(
              'The requested quantity is not available right now',
            );
          }
          await transaction.inventoryEvent.createMany({
            data: vouchers.map((voucher) => ({
              voucherId: voucher.id,
              eventType: 'VOUCHER_RESERVED',
              previousAvailability: 'AVAILABLE' as const,
              resultingAvailability: 'RESERVED' as const,
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
            order.product.name,
            attempt,
            false,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __orderResult;
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
          orderBy: { attemptNumber: 'desc' },
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
        providerStatus: null,
        displayText: null,
        authorizationExpiresAt: attempt.authorizationExpiresAt.toISOString(),
      },
      checkoutAccessToken: this.checkoutAccess.create(
        order.publicReference,
        this.checkoutAccess.expiresAtFor(attempt.authorizationExpiresAt),
      ),
      checkoutAccessExpiresAt: this.checkoutAccess
        .expiresAtFor(attempt.authorizationExpiresAt)
        .toISOString(),
      replayed,
    };
  }

  async listOrdersForAgent(
    agentId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.listOrders({ agentId }, page, limit);
  }

  async listOrdersForAdmin(page: number = 1, limit: number = 10) {
    return this.listOrders({}, page, limit);
  }

  private async listOrders(
    where: Prisma.OrderWhereInput,
    page: number,
    limit: number,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const totalItems = await this.prisma.order.count({
      where,
    });
    const totalPages = Math.ceil(totalItems / safeLimit);
    const currentPage = totalPages > 0 ? Math.min(safePage, totalPages) : 1;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * safeLimit,
      take: safeLimit,
      select: {
        id: true,
        publicReference: true,
        quantity: true,
        retailTotalMinor: true,
        agentProfitTotalMinor: true,
        deliveryPhoneMask: true,
        paymentState: true,
        fulfillmentState: true,
        createdAt: true,
        deliveryMessages: {
          select: { channel: true, state: true },
          orderBy: { createdAt: 'asc' },
        },
        agent: {
          select: { name: true },
        },
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      items: orders.map((order) => {
        const delivery = summarizeOrderDelivery(order.deliveryMessages);
        return {
          id: order.id,
          publicReference: order.publicReference,
          productName: order.product.name,
          quantity: order.quantity,
          retailTotalMinor: order.retailTotalMinor.toString(),
          agentProfitTotalMinor: order.agentProfitTotalMinor.toString(),
          deliveryPhoneMask: order.deliveryPhoneMask,
          paymentState: order.paymentState,
          fulfillmentState: order.fulfillmentState,
          deliveryStatus: delivery.status,
          deliveryChannels: delivery.channels,
          agentName: order.agent.name,
          createdAt: order.createdAt.toISOString(),
        };
      }),
      pagination: {
        totalItems,
        totalPages,
        currentPage,
        limit: safeLimit,
        hasNextPage: currentPage < totalPages,
      },
    };
  }

  async getAgentSalesSummary(agentId: string) {
    const { today, thisWeek, total } = await this.aggregateAgentSales(agentId);
    return {
      today: toAgentWindow(today),
      thisWeek: toAgentWindow(thisWeek),
      total: toAgentWindow(total),
    };
  }

  async getAgentSalesSummaryForAdmin(agentId: string) {
    const { today, thisWeek, total } = await this.aggregateAgentSales(agentId);
    return {
      today: toAdminWindow(today),
      thisWeek: toAdminWindow(thisWeek),
      total: toAdminWindow(total),
    };
  }

  private async aggregateAgentSales(agentId: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(
      startOfToday.getTime() - dayOfWeek * 86_400_000,
    );

    const [today, thisWeek, total] = await Promise.all([
      this.aggregateAgentSalesSince(agentId, startOfToday),
      this.aggregateAgentSalesSince(agentId, startOfWeek),
      this.aggregateAgentSalesSince(agentId),
    ]);
    return { today, thisWeek, total };
  }

  private aggregateAgentSalesSince(agentId: string, since?: Date) {
    return this.prisma.order.aggregate({
      where: {
        agentId,
        paymentState: 'PAID',
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: {
        quantity: true,
        agentProfitTotalMinor: true,
        retailTotalMinor: true,
      },
      _count: { id: true },
    });
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

export type OrderDeliveryStatus =
  | 'NOT_STARTED'
  | DeliveryMessageState
  | 'PARTIAL';

function summarizeOrderDelivery(
  messages: Array<{ channel: DeliveryChannel; state: DeliveryMessageState }>,
): {
  status: OrderDeliveryStatus;
  channels: Array<{
    channel: DeliveryChannel;
    status: Exclude<OrderDeliveryStatus, 'NOT_STARTED'>;
  }>;
} {
  if (messages.length === 0) return { status: 'NOT_STARTED', channels: [] };

  const states = messages.map((message) => message.state);
  const byChannel = new Map<DeliveryChannel, DeliveryMessageState[]>();
  for (const message of messages) {
    const channelStates = byChannel.get(message.channel) ?? [];
    channelStates.push(message.state);
    byChannel.set(message.channel, channelStates);
  }

  return {
    status: summarizeDeliveryStates(states),
    channels: Array.from(byChannel, ([channel, channelStates]) => ({
      channel,
      status: summarizeDeliveryStates(channelStates),
    })),
  };
}

function summarizeDeliveryStates(
  states: DeliveryMessageState[],
): Exclude<OrderDeliveryStatus, 'NOT_STARTED'> {
  const uniqueStates = new Set(states);
  if (uniqueStates.size === 1) return states[0];
  if (uniqueStates.has(DeliveryMessageState.UNKNOWN)) {
    return DeliveryMessageState.UNKNOWN;
  }
  return 'PARTIAL';
}

type SalesAggregate = {
  _count: { id: number };
  _sum: {
    quantity: number | null;
    agentProfitTotalMinor: bigint | null;
    retailTotalMinor: bigint | null;
  };
};

function toAgentWindow(aggregate: SalesAggregate) {
  return {
    orderCount: aggregate._count.id,
    unitsSold: aggregate._sum.quantity ?? 0,
    profitMinor: (aggregate._sum.agentProfitTotalMinor ?? 0n).toString(),
  };
}

function toAdminWindow(aggregate: SalesAggregate) {
  const retailTotalMinor = aggregate._sum.retailTotalMinor ?? 0n;
  const agentProfitMinor = aggregate._sum.agentProfitTotalMinor ?? 0n;
  return {
    orderCount: aggregate._count.id,
    unitsSold: aggregate._sum.quantity ?? 0,
    agentProfitMinor: agentProfitMinor.toString(),
    platformProfitMinor: (retailTotalMinor - agentProfitMinor).toString(),
    retailTotalMinor: retailTotalMinor.toString(),
  };
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

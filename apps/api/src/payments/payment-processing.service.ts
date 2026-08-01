import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../operations/outbox.service';
import { OrderContactProtectionService } from '../orders/order-contact-protection.service';
import {
  PaymentGatewayService,
  PaymentProviderRequestException,
  type ProviderPaymentResult,
} from './payment-gateway.service';

const TERMINAL_FAILURES = new Set(['failed', 'abandoned']);
const RECONCILIATION_GRACE_MS = 5 * 60 * 1_000;
const AMBIGUOUS_VERIFICATION_RETRY_MS = 60_000;
const POST_RELEASE_RECONCILIATION_MS = 15 * 60 * 1_000;

export interface SerializedPaymentAttempt {
  reference: string;
  state: string;
  providerStatus: string | null;
  displayText: string | null;
  authorizationExpiresAt: string;
}

export interface InitializedPaymentAttempt extends SerializedPaymentAttempt {
  accessCode: string;
}

@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: OrderContactProtectionService,
    private readonly gateway: PaymentGatewayService,
    private readonly outbox: OutboxService,
  ) {}

  async initializePayment(
    providerReference: string,
  ): Promise<InitializedPaymentAttempt> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { providerReference },
      include: { order: true },
    });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    if (attempt.state !== 'CREATED') {
      return this.serializeInitializedAttempt(attempt);
    }

    let result: ProviderPaymentResult;
    try {
      result = await this.gateway.initialize({
        reference: attempt.providerReference,
        amountMinor: attempt.expectedAmountMinor,
        currency: attempt.currency.trim(),
        email: this.contacts.revealEmail(
          attempt.syntheticEmailCiphertext,
          'synthetic',
        ),
      });
    } catch (error) {
      if (!(error instanceof PaymentProviderRequestException)) throw error;
      this.logInitializationFailure(attempt.providerReference, error);
      if (error.kind === 'definitive') {
        await this.releaseRejectedInitialization(attempt.id);
        throw new UnprocessableEntityException(
          'Paystack rejected payment setup. Please confirm your details and try again.',
        );
      }
      const reconciling = await this.prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, state: 'CREATED' },
        data: {
          state: 'RECONCILING',
          providerStatus: 'INITIATION_UNCONFIRMED',
          authorizationDisplayText:
            'We could not confirm whether Paystack sent a payment prompt. Do not submit again while we verify this payment.',
          nextReconciliationAt: new Date(Date.now() + 60_000),
          version: { increment: 1 },
        },
      });
      if (reconciling.count !== 1) {
        return this.initializePayment(providerReference);
      }
      throw new ConflictException(
        'Paystack checkout could not be confirmed. Please refresh the page before trying again.',
      );
    }
    if (!result.accessCode) {
      throw new Error('Paystack did not return a checkout access code');
    }
    const initializedAt = new Date();
    await this.prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, state: 'CREATED' },
      data: {
        state: 'PENDING_AUTHORIZATION',
        providerStatus: result.status,
        providerTransactionId: result.transactionId,
        providerAccessCode: result.accessCode,
        authorizationDisplayText: result.displayText,
        initializedAt,
        nextReconciliationAt: attempt.authorizationExpiresAt,
        version: { increment: 1 },
      },
    });
    this.logger.log(
      `Payment initialized reference=${attempt.providerReference} mode=${this.gateway.mode}`,
    );
    return this.serializeInitializedAttempt({
      ...attempt,
      state: 'PENDING_AUTHORIZATION',
      providerStatus: result.status,
      providerAccessCode: result.accessCode,
      authorizationDisplayText: result.displayText,
    });
  }

  async getPublicOrderStatus(webSalesId: string, orderReference: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicReference: orderReference, channelIdSnapshot: webSalesId },
      include: {
        paymentAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
        deliveryMessages: { select: { state: true, channel: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const attempt = order.paymentAttempts[0];
    return {
      orderReference: order.publicReference,
      paymentState: order.paymentState,
      fulfillmentState: order.fulfillmentState,
      payment: attempt ? this.serializeAttempt(attempt) : null,
      delivery: summarizeDelivery(order.deliveryMessages),
    };
  }

  async processPaystackWebhook(rawBody: Buffer, signature?: string) {
    this.gateway.assertWebhookSignature(rawBody, signature);
    const payload = parseWebhook(rawBody);
    const identity = createHash('sha256').update(rawBody).digest('hex');
    const fingerprint = createHash('sha256').update(rawBody).digest();
    const attempt = payload.reference
      ? await this.prisma.paymentAttempt.findUnique({
          where: { providerReference: payload.reference },
          select: { id: true },
        })
      : null;
    const event = await this.prisma.paymentEvent.upsert({
      where: { providerEventIdentity: identity },
      create: {
        paymentAttemptId: attempt?.id,
        providerEventIdentity: identity,
        eventType: payload.eventType,
        providerReference: payload.reference,
        providerTransactionId: payload.transactionId,
        reportedAmountMinor: payload.amountMinor,
        reportedCurrency: payload.currency,
        payloadFingerprint: fingerprint,
        safeMetadata: { providerStatus: payload.status },
      },
      update: {},
    });
    if (event.processingState !== 'RECEIVED') return { accepted: true };
    if (!payload.reference || !attempt) {
      await this.finishEvent(event.id, 'IGNORED');
      return { accepted: true };
    }
    if (payload.eventType !== 'charge.success') {
      if (TERMINAL_FAILURES.has(payload.status ?? '')) {
        await this.processProviderResult(payload.reference, payload, event.id);
      } else {
        await this.finishEvent(event.id, 'IGNORED');
      }
      return { accepted: true };
    }

    const verified = await this.gateway.verify(payload.reference);
    await this.processProviderResult(payload.reference, verified, event.id);
    return { accepted: true };
  }

  async verifyPayment(providerReference: string) {
    return this.reconcileDuePayment(providerReference);
  }

  /**
   * Claims due attempts with a lease. A second worker can safely retry after
   * the lease expires if this process stops while Paystack is being queried.
   */
  async claimDueReconciliationAttempts(limit = 20): Promise<string[]> {
    const now = new Date();
    const candidates = await this.prisma.paymentAttempt.findMany({
      where: {
        state: { in: ['PENDING_AUTHORIZATION', 'RECONCILING', 'VERIFYING'] },
        nextReconciliationAt: { lte: now },
      },
      orderBy: { nextReconciliationAt: 'asc' },
      take: Math.max(1, Math.min(limit, 100)),
      select: { id: true, providerReference: true },
    });
    const leaseUntil = new Date(
      now.getTime() + AMBIGUOUS_VERIFICATION_RETRY_MS,
    );
    const claimed: string[] = [];
    for (const candidate of candidates) {
      const result = await this.prisma.paymentAttempt.updateMany({
        where: {
          id: candidate.id,
          state: { in: ['PENDING_AUTHORIZATION', 'RECONCILING', 'VERIFYING'] },
          nextReconciliationAt: { lte: now },
        },
        data: {
          state: 'VERIFYING',
          nextReconciliationAt: leaseUntil,
          version: { increment: 1 },
        },
      });
      if (result.count === 1) claimed.push(candidate.providerReference);
    }
    return claimed;
  }

  async reconcileDuePayment(providerReference: string) {
    try {
      const result = await this.gateway.verify(providerReference);
      return this.processProviderResult(providerReference, result);
    } catch (error) {
      if (error instanceof PaymentProviderRequestException) {
        await this.recordAmbiguousVerification(providerReference, error);
      }
      throw error;
    }
  }

  async verifyPublicPayment(webSalesId: string, orderReference: string) {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        order: {
          publicReference: orderReference,
          channelIdSnapshot: webSalesId,
        },
      },
      orderBy: { attemptNumber: 'desc' },
      select: { providerReference: true },
    });
    if (!attempt) throw new NotFoundException('Order not found');
    await this.verifyPayment(attempt.providerReference);
    return this.getPublicOrderStatus(webSalesId, orderReference);
  }

  private async releaseRejectedInitialization(paymentAttemptId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
        where: { id: paymentAttemptId },
        include: { reservation: { include: { items: true } } },
      });
      if (attempt.state !== 'CREATED') return;
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          state: 'FAILED',
          providerStatus: 'INITIATION_REJECTED',
          nextReconciliationAt: null,
          version: { increment: 1 },
        },
      });
      if (attempt.reservation?.state !== 'ACTIVE') return;
      const voucherIds = attempt.reservation.items.map(
        (item) => item.voucherId,
      );
      await transaction.inventoryReservation.update({
        where: { id: attempt.reservation.id },
        data: { state: 'RELEASED', version: { increment: 1 } },
      });
      await transaction.voucher.updateMany({
        where: { id: { in: voucherIds }, availability: 'RESERVED' },
        data: { availability: 'AVAILABLE', version: { increment: 1 } },
      });
      await transaction.inventoryEvent.createMany({
        data: voucherIds.map((voucherId) => ({
          voucherId,
          eventType: 'PAYMENT_INITIALIZATION_REJECTED',
          previousAvailability: 'RESERVED' as const,
          resultingAvailability: 'AVAILABLE' as const,
          sourceType: 'PAYMENT_INITIALIZATION',
          sourceId: attempt.id,
          safeMetadata: { reservationId: attempt.reservation!.id },
        })),
        skipDuplicates: true,
      });
    });
  }

  private logInitializationFailure(
    providerReference: string,
    error: PaymentProviderRequestException,
  ) {
    const message = `Paystack initialization ${error.kind} reference=${providerReference} httpStatus=${error.providerStatusCode ?? 'none'} reason=${redactProviderMessage(error.providerMessage)}`;
    if (error.kind === 'definitive') {
      this.logger.warn(message);
    } else {
      this.logger.error(message);
    }
  }

  private async processProviderResult(
    providerReference: string,
    result: ProviderPaymentResult,
    eventId?: string,
  ) {
    const expected = await this.prisma.paymentAttempt.findUnique({
      where: { providerReference },
      select: { expectedAmountMinor: true, currency: true },
    });
    if (!expected) throw new NotFoundException('Payment attempt not found');
    if (
      result.reference !== providerReference ||
      (result.status === 'success' &&
        (result.amountMinor !== expected.expectedAmountMinor ||
          result.currency !== expected.currency.trim()))
    ) {
      if (eventId) await this.finishEvent(eventId, 'INVESTIGATION');
      await this.prisma.paymentAttempt.update({
        where: { providerReference },
        data: {
          state: 'VERIFYING',
          providerStatus: result.status,
          lastVerifiedAt: new Date(),
          version: { increment: 1 },
        },
      });
      this.logger.error(`Payment mismatch reference=${providerReference}`);
      return { state: 'INVESTIGATION' as const };
    }
    if (result.status === 'success') {
      const outcome = await this.applySuccessfulPayment(
        providerReference,
        result,
      );
      if (eventId) await this.finishEvent(eventId, 'PROCESSED');
      return outcome;
    }
    if (TERMINAL_FAILURES.has(result.status)) {
      const outcome = await this.applyTerminalFailure(
        providerReference,
        result,
      );
      if (eventId) await this.finishEvent(eventId, 'PROCESSED');
      return outcome;
    }
    const updated = await this.recordNonTerminalResult(
      providerReference,
      result,
    );
    if (eventId) await this.finishEvent(eventId, 'PROCESSED');
    return this.serializeAttempt(updated);
  }

  private async recordAmbiguousVerification(
    providerReference: string,
    error: PaymentProviderRequestException,
  ) {
    const result = await this.prisma.paymentAttempt.updateMany({
      where: {
        providerReference,
        state: { in: ['PENDING_AUTHORIZATION', 'VERIFYING', 'RECONCILING'] },
      },
      data: {
        state: 'RECONCILING',
        providerStatus: 'VERIFICATION_UNCONFIRMED',
        lastVerifiedAt: new Date(),
        nextReconciliationAt: new Date(
          Date.now() + AMBIGUOUS_VERIFICATION_RETRY_MS,
        ),
        version: { increment: 1 },
      },
    });
    if (result.count === 1) {
      this.logger.warn(
        `Paystack verification ambiguous reference=${providerReference} httpStatus=${error.providerStatusCode ?? 'none'} reason=${redactProviderMessage(error.providerMessage)}`,
      );
    }
  }

  private async recordNonTerminalResult(
    providerReference: string,
    payment: ProviderPaymentResult,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "payment_attempt"
        WHERE provider_reference = ${providerReference}
        FOR UPDATE
      `;
      const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
        where: { providerReference },
        include: { reservation: { include: { items: true } } },
      });
      if (
        attempt.state === 'SUCCESS' ||
        attempt.state === 'FAILED' ||
        attempt.state === 'ABANDONED'
      ) {
        return attempt;
      }

      const now = new Date();
      const graceEndsAt = new Date(
        attempt.authorizationExpiresAt.getTime() + RECONCILIATION_GRACE_MS,
      );
      const reservation = attempt.reservation;
      const releaseReservation =
        reservation?.state === 'ACTIVE' && now >= graceEndsAt;
      const nextReconciliationAt =
        now < attempt.authorizationExpiresAt
          ? attempt.authorizationExpiresAt
          : releaseReservation
            ? new Date(now.getTime() + POST_RELEASE_RECONCILIATION_MS)
            : graceEndsAt;

      const updated = await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          state: 'RECONCILING',
          providerStatus: payment.status,
          providerTransactionId: payment.transactionId,
          lastVerifiedAt: now,
          nextReconciliationAt,
          version: { increment: 1 },
        },
      });
      if (releaseReservation && reservation) {
        const voucherIds = reservation.items.map((item) => item.voucherId);
        await transaction.inventoryReservation.update({
          where: { id: reservation.id },
          data: { state: 'RELEASED', version: { increment: 1 } },
        });
        await transaction.voucher.updateMany({
          where: { id: { in: voucherIds }, availability: 'RESERVED' },
          data: { availability: 'AVAILABLE', version: { increment: 1 } },
        });
        await transaction.inventoryEvent.createMany({
          data: voucherIds.map((voucherId) => ({
            voucherId,
            eventType: 'PAYMENT_RECONCILIATION_GRACE_EXPIRED',
            previousAvailability: 'RESERVED' as const,
            resultingAvailability: 'AVAILABLE' as const,
            sourceType: 'PAYMENT_RECONCILIATION',
            sourceId: attempt.id,
            safeMetadata: { reservationId: reservation.id },
          })),
          skipDuplicates: true,
        });
        this.logger.warn(
          `Payment reconciliation grace expired; reservation released reference=${providerReference}`,
        );
      }
      return updated;
    });
  }

  private applySuccessfulPayment(
    providerReference: string,
    result: ProviderPaymentResult,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id FROM "payment_attempt"
          WHERE provider_reference = ${providerReference}
          FOR UPDATE
        `;
        const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
          where: { providerReference },
          include: {
            order: { include: { items: { orderBy: { position: 'asc' } } } },
            reservation: {
              include: {
                items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        });
        if (attempt.state === 'SUCCESS') {
          return {
            state: 'SUCCESS' as const,
            classification: attempt.classification,
          };
        }
        if (
          attempt.order.acceptedPaymentAttemptId &&
          attempt.order.acceptedPaymentAttemptId !== attempt.id
        ) {
          await transaction.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              state: 'SUCCESS',
              classification: 'EXCESS',
              providerStatus: result.status,
              providerTransactionId: result.transactionId,
              lastVerifiedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await this.outbox.enqueue(transaction, {
            eventType: 'EXCESS_PAYMENT_REFUND_REQUIRED',
            aggregateType: 'PAYMENT_ATTEMPT',
            aggregateId: attempt.id,
            aggregateVersion: attempt.version + 1,
            payload: { paymentAttemptId: attempt.id },
          });
          return {
            state: 'SUCCESS' as const,
            classification: 'EXCESS' as const,
          };
        }
        const reservation = attempt.reservation;
        if (!reservation || reservation.state !== 'ACTIVE') {
          await transaction.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              state: 'SUCCESS',
              classification: 'ACCEPTED',
              providerStatus: result.status,
              providerTransactionId: result.transactionId,
              lastVerifiedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await transaction.order.update({
            where: { id: attempt.orderId },
            data: {
              acceptedPaymentAttemptId: attempt.id,
              paymentState: 'PAID',
              fulfillmentState: 'EXCEPTION',
              version: { increment: 1 },
            },
          });
          await this.outbox.enqueue(transaction, {
            eventType: 'PAID_ORDER_INVENTORY_EXCEPTION',
            aggregateType: 'ORDER',
            aggregateId: attempt.orderId,
            aggregateVersion: attempt.order.version + 1,
            payload: { orderId: attempt.orderId },
          });
          return {
            state: 'SUCCESS' as const,
            classification: 'ACCEPTED' as const,
          };
        }

        const voucherIds = reservation.items.map((item) => item.voucherId);
        if (
          attempt.order.items.length !== attempt.order.quantity ||
          voucherIds.length !== attempt.order.quantity
        ) {
          throw new ConflictException('Order allocation is incomplete');
        }
        const sold = await transaction.voucher.updateMany({
          where: { id: { in: voucherIds }, availability: 'RESERVED' },
          data: { availability: 'SOLD', version: { increment: 1 } },
        });
        if (sold.count !== attempt.order.quantity) {
          throw new ConflictException(
            'Reserved inventory changed unexpectedly',
          );
        }
        await transaction.voucherAllocation.createMany({
          data: attempt.order.items.map((item, index) => ({
            orderItemId: item.id,
            voucherId: voucherIds[index],
          })),
          skipDuplicates: true,
        });
        await transaction.inventoryReservation.update({
          where: { id: reservation.id },
          data: { state: 'CONSUMED', version: { increment: 1 } },
        });
        await transaction.orderItem.updateMany({
          where: { orderId: attempt.orderId, fulfillmentState: 'PENDING' },
          data: { fulfillmentState: 'COMPLETE' },
        });
        await transaction.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            state: 'SUCCESS',
            classification: 'ACCEPTED',
            providerStatus: result.status,
            providerTransactionId: result.transactionId,
            lastVerifiedAt: new Date(),
            nextReconciliationAt: null,
            version: { increment: 1 },
          },
        });
        await transaction.order.update({
          where: { id: attempt.orderId },
          data: {
            acceptedPaymentAttemptId: attempt.id,
            paymentState: 'PAID',
            fulfillmentState: 'COMPLETE',
            version: { increment: 1 },
          },
        });
        const wallet = await transaction.walletAccount.upsert({
          where: { agentId: attempt.order.agentId },
          create: {
            agentId: attempt.order.agentId,
            currency: attempt.order.currency,
          },
          update: {},
        });
        await transaction.ledgerEntry.create({
          data: {
            walletAccountId: wallet.id,
            orderId: attempt.orderId,
            paymentAttemptId: attempt.id,
            type: 'SALE_CREDIT',
            amountMinor: attempt.order.agentProfitTotalMinor,
            currency: attempt.order.currency,
            sourceType: 'ORDER_SALE',
            sourceId: attempt.orderId,
          },
        });
        await transaction.inventoryEvent.createMany({
          data: voucherIds.map((voucherId) => ({
            voucherId,
            eventType: 'VOUCHER_SOLD',
            previousAvailability: 'RESERVED' as const,
            resultingAvailability: 'SOLD' as const,
            sourceType: 'PAYMENT_SUCCESS',
            sourceId: attempt.id,
            safeMetadata: { orderId: attempt.orderId },
          })),
          skipDuplicates: true,
        });
        const deliveryMessages = [];
        for (const item of attempt.order.items) {
          deliveryMessages.push(
            await transaction.deliveryMessage.create({
              data: {
                orderId: attempt.orderId,
                orderItemId: item.id,
                channel: 'SMS',
                destinationCiphertext: attempt.order.deliveryPhoneCiphertext,
                destinationMask: attempt.order.deliveryPhoneMask,
                contactEncryptionKeyId: attempt.order.contactEncryptionKeyId,
                contactFormatVersion: attempt.order.contactFormatVersion,
                stableClientReference: `sms-${item.id}`,
              },
            }),
          );
        }
        if (
          attempt.order.deliveryEmailCiphertext &&
          attempt.order.deliveryEmailMask
        ) {
          deliveryMessages.push(
            await transaction.deliveryMessage.create({
              data: {
                orderId: attempt.orderId,
                channel: 'EMAIL',
                destinationCiphertext: attempt.order.deliveryEmailCiphertext,
                destinationMask: attempt.order.deliveryEmailMask,
                contactEncryptionKeyId: attempt.order.contactEncryptionKeyId,
                contactFormatVersion: attempt.order.contactFormatVersion,
                stableClientReference: `email-${attempt.orderId}`,
              },
            }),
          );
        }
        for (const message of deliveryMessages) {
          await this.outbox.enqueue(transaction, {
            eventType: 'DELIVERY_MESSAGE_REQUESTED',
            aggregateType: 'DELIVERY_MESSAGE',
            aggregateId: message.id,
            aggregateVersion: 1,
            payload: { deliveryMessageId: message.id },
          });
        }
        this.logger.log(`Payment accepted reference=${providerReference}`);
        return {
          state: 'SUCCESS' as const,
          classification: 'ACCEPTED' as const,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private applyTerminalFailure(
    providerReference: string,
    result: ProviderPaymentResult,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "payment_attempt"
        WHERE provider_reference = ${providerReference}
        FOR UPDATE
      `;
      const attempt = await transaction.paymentAttempt.findUniqueOrThrow({
        where: { providerReference },
        include: { reservation: { include: { items: true } } },
      });
      if (attempt.state === 'SUCCESS') return this.serializeAttempt(attempt);
      const terminalState =
        result.status === 'abandoned' ? 'ABANDONED' : 'FAILED';
      if (attempt.state !== 'FAILED' && attempt.state !== 'ABANDONED') {
        await transaction.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            state: terminalState,
            providerStatus: result.status,
            providerTransactionId: result.transactionId,
            lastVerifiedAt: new Date(),
            nextReconciliationAt: null,
            version: { increment: 1 },
          },
        });
      }
      if (attempt.reservation?.state === 'ACTIVE') {
        const voucherIds = attempt.reservation.items.map(
          (item) => item.voucherId,
        );
        await transaction.inventoryReservation.update({
          where: { id: attempt.reservation.id },
          data: { state: 'RELEASED', version: { increment: 1 } },
        });
        await transaction.voucher.updateMany({
          where: { id: { in: voucherIds }, availability: 'RESERVED' },
          data: { availability: 'AVAILABLE', version: { increment: 1 } },
        });
        await transaction.inventoryEvent.createMany({
          data: voucherIds.map((voucherId) => ({
            voucherId,
            eventType: 'PAYMENT_RESERVATION_RELEASED',
            previousAvailability: 'RESERVED' as const,
            resultingAvailability: 'AVAILABLE' as const,
            sourceType: 'PAYMENT_FAILURE',
            sourceId: attempt.id,
            safeMetadata: { reservationId: attempt.reservation!.id },
          })),
          skipDuplicates: true,
        });
      }
      this.logger.warn(
        `Payment ended reference=${providerReference} state=${terminalState}`,
      );
      return { state: terminalState };
    });
  }

  private finishEvent(
    eventId: string,
    state: 'PROCESSED' | 'IGNORED' | 'INVESTIGATION',
  ) {
    return this.prisma.paymentEvent.update({
      where: { id: eventId },
      data: { processingState: state, processedAt: new Date() },
    });
  }

  private serializeAttempt(attempt: {
    providerReference: string;
    state: string;
    providerStatus: string | null;
    authorizationDisplayText: string | null;
    authorizationExpiresAt: Date;
  }): SerializedPaymentAttempt {
    return {
      reference: attempt.providerReference,
      state: attempt.state,
      providerStatus: attempt.providerStatus,
      displayText: attempt.authorizationDisplayText,
      authorizationExpiresAt: attempt.authorizationExpiresAt.toISOString(),
    };
  }

  private serializeInitializedAttempt(attempt: {
    providerReference: string;
    providerAccessCode: string | null;
    state: string;
    providerStatus: string | null;
    authorizationDisplayText: string | null;
    authorizationExpiresAt: Date;
  }): InitializedPaymentAttempt {
    if (!attempt.providerAccessCode) {
      throw new ConflictException('Paystack checkout is no longer available');
    }
    return {
      ...this.serializeAttempt(attempt),
      accessCode: attempt.providerAccessCode,
    };
  }
}

function parseWebhook(rawBody: Buffer): ProviderPaymentResult & {
  eventType: string;
} {
  let value: unknown;
  try {
    value = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    throw new BadRequestException('Invalid webhook payload');
  }
  if (
    !isRecord(value) ||
    typeof value.event !== 'string' ||
    !isRecord(value.data)
  ) {
    throw new BadRequestException('Invalid webhook payload');
  }
  const data = value.data;
  return {
    eventType: value.event,
    reference: stringValue(data.reference) ?? '',
    status: stringValue(data.status) ?? '',
    amountMinor: bigintValue(data.amount),
    currency: stringValue(data.currency)?.toUpperCase() ?? null,
    transactionId: stringValue(data.id),
    accessCode: null,
    displayText: null,
    message: stringValue(data.gateway_response) ?? stringValue(data.message),
  };
}

function summarizeDelivery(
  messages: Array<{ state: string; channel: string }>,
) {
  return {
    total: messages.length,
    pending: messages.filter((message) => message.state === 'PENDING').length,
    delivered: messages.filter((message) => message.state === 'DELIVERED')
      .length,
    channels: [...new Set(messages.map((message) => message.channel))],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function bigintValue(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function redactProviderMessage(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+?233\d{9}|\b0\d{9}\b/g, '[redacted-phone]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 240);
}

import { Injectable, Logger } from '@nestjs/common';
import { OutboxState, Prisma, RefundState } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../operations/outbox.service';
import {
  PaymentGatewayService,
  PaymentProviderRequestException,
} from '../payments/payment-gateway.service';

@Injectable()
export class RefundOutboxHandler {
  private readonly logger = new Logger(RefundOutboxHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  async handleClaimed(eventId: string, claimToken: string) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: eventId,
        claimToken,
        state: { in: [OutboxState.CLAIMED, OutboxState.QUEUED] },
        eventType: 'REFUND_SUBMISSION_REQUIRED',
      },
    });
    if (!event) return false;
    const refund = await this.prisma.refund.findUnique({
      where: { id: event.aggregateId },
      include: { paymentAttempt: true },
    });
    if (
      !refund ||
      refund.state === RefundState.SUCCESS ||
      refund.state === RefundState.FAILED ||
      refund.state === RefundState.CANCELLED
    ) {
      await this.outbox.markDispatched(event.id, claimToken);
      return true;
    }

    if (refund.providerReference) {
      await this.outbox.markDispatched(event.id, claimToken);
      return true;
    }

    const submissionKey =
      refund.submissionKey ?? `dashchecker-refund-${event.id}`;
    const submissionState = refund.state;
    if (!refund.submissionKey) {
      const claimed = await this.prisma.refund.updateMany({
        where: {
          id: refund.id,
          state: RefundState.APPROVED,
          submissionKey: null,
        },
        data: {
          submissionKey,
          state: RefundState.SUBMITTING,
          attemptCount: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        const current = await this.prisma.refund.findUnique({
          where: { id: refund.id },
          include: { paymentAttempt: true },
        });
        if (!current) {
          await this.outbox.markDispatched(event.id, claimToken);
          return true;
        }
        if (current.providerReference) {
          await this.outbox.markDispatched(event.id, claimToken);
          return true;
        }
        if (current.submissionKey) {
          // Another task won the race; defer to reconciliation which will find provider refund via deterministic key
          await this.deferUnknownOutcome(event.id, claimToken, refund.id);
          return false;
        }
        // Still APPROVED but race lost due to concurrent transition; reschedule for retry
        await this.outbox.reschedule(event.id, claimToken, {
          availableAt: new Date(Date.now() + 5_000),
          error: 'refund submission race; retry',
        });
        return false;
      }
    }

    try {
      const existing = await this.gateway.findRefundByTransaction({
        transactionReference: refund.paymentAttempt.providerReference,
        providerTransactionId: refund.paymentAttempt.providerTransactionId,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        merchantNote: submissionKey,
      });
      if (existing) {
        await this.recordProviderOutcome(refund.id, existing);
        await this.outbox.markDispatched(event.id, claimToken);
        return true;
      }

      // Once a POST has been attempted, a missing provider match is
      // intentionally not retried automatically: Paystack does not expose
      // an idempotency-key parameter for refunds, so another POST could
      // create a duplicate refund.
      if (submissionState !== RefundState.APPROVED) {
        await this.deferUnknownOutcome(event.id, claimToken, refund.id);
        return false;
      }

      const submitted = await this.gateway.submitRefund({
        transactionReference: refund.paymentAttempt.providerReference,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        merchantNote: submissionKey,
      });
      await this.recordProviderOutcome(refund.id, submitted);
      await this.outbox.markDispatched(event.id, claimToken);
      this.logger.log(`Paystack refund submitted refundId=${refund.id}`);
      return true;
    } catch (error) {
      const ambiguous =
        error instanceof PaymentProviderRequestException &&
        error.kind === 'ambiguous';
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          state: ambiguous ? RefundState.PENDING : RefundState.FAILED,
          nextReconciliationAt: ambiguous
            ? new Date(Date.now() + 30_000)
            : null,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : 'Refund submission failed',
          safeMetadata: {
            ...(refund.safeMetadata as Prisma.JsonObject),
            submissionOutcome: ambiguous ? 'UNKNOWN' : 'REJECTED',
            submissionKey,
          },
        },
      });
      await this.outbox.reschedule(event.id, claimToken, {
        availableAt: new Date(Date.now() + (ambiguous ? 30_000 : 0)),
        error: ambiguous
          ? 'refund submission outcome unknown; reconcile before retry'
          : 'refund submission rejected',
        terminal: !ambiguous,
      });
      if (!ambiguous) throw error;
      return false;
    }
  }

  private async recordProviderOutcome(
    refundId: string,
    outcome: { reference: string; status: string },
  ) {
    await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        providerReference: outcome.reference,
        state: refundStateFromProvider(outcome.status),
        nextReconciliationAt:
          refundStateFromProvider(outcome.status) === RefundState.PENDING
            ? new Date(Date.now() + 30_000)
            : null,
        lastError: null,
      },
    });
  }

  private async deferUnknownOutcome(
    eventId: string,
    claimToken: string,
    refundId: string,
  ) {
    const nextReconciliationAt = new Date(Date.now() + 30_000);
    const updated = await this.prisma.refund.updateMany({
      where: {
        id: refundId,
        providerReference: null,
        state: {
          in: [
            RefundState.SUBMITTING,
            RefundState.PENDING,
            RefundState.APPROVED,
          ],
        },
      },
      data: { state: RefundState.PENDING, nextReconciliationAt },
    });
    if (updated.count === 0) {
      const current = await this.prisma.refund.findUnique({
        where: { id: refundId },
        select: { state: true, providerReference: true },
      });
      if (
        current?.providerReference ||
        current?.state === RefundState.SUCCESS ||
        current?.state === RefundState.FAILED ||
        current?.state === RefundState.CANCELLED
      ) {
        await this.outbox.markDispatched(eventId, claimToken);
        return;
      }
    }
    await this.outbox.reschedule(eventId, claimToken, {
      availableAt: nextReconciliationAt,
      error: 'refund not visible at provider; reconciliation will retry lookup',
    });
  }
}

function refundStateFromProvider(status: string): RefundState {
  if (status === 'processed' || status === 'success')
    return RefundState.SUCCESS;
  if (status === 'failed') return RefundState.FAILED;
  return RefundState.PENDING;
}

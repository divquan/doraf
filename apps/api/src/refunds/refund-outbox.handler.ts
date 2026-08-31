import { Injectable, Logger } from '@nestjs/common';
import { OutboxState, RefundState } from '../generated/prisma/client';
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
    if (!refund || refund.state !== RefundState.APPROVED) {
      await this.outbox.markDispatched(event.id, claimToken);
      return true;
    }
    await this.prisma.refund.update({
      where: { id: refund.id },
      data: { state: RefundState.SUBMITTED },
    });
    try {
      const submitted = await this.gateway.submitRefund({
        transactionReference: refund.paymentAttempt.providerReference,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
      });
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          providerReference: submitted.reference,
          state: refundStateFromProvider(submitted.status),
        },
      });
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
          safeMetadata: {
            ...(refund.safeMetadata as object),
            submissionOutcome: ambiguous ? 'UNKNOWN' : 'REJECTED',
          },
        },
      });
      await this.outbox.reschedule(event.id, claimToken, {
        availableAt: new Date(),
        error: ambiguous
          ? 'refund submission outcome unknown; reconcile before retry'
          : 'refund submission rejected',
        terminal: true,
      });
      throw error;
    }
  }
}

function refundStateFromProvider(status: string): RefundState {
  if (status === 'processed' || status === 'success')
    return RefundState.SUCCESS;
  if (status === 'failed') return RefundState.FAILED;
  return RefundState.PENDING;
}

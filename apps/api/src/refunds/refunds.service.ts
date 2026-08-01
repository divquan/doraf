import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundState } from '../generated/prisma/client';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { OutboxService } from '../operations/outbox.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  listRequested() {
    return this.prisma.refund.findMany({
      where: { state: RefundState.REQUESTED },
      orderBy: { requestedAt: 'asc' },
      select: {
        id: true,
        orderId: true,
        paymentAttemptId: true,
        amountMinor: true,
        currency: true,
        reason: true,
        requestedAt: true,
        safeMetadata: true,
        order: { select: { publicReference: true } },
      },
    });
  }

  async approve(input: {
    refundId: string;
    reason: string;
    actor: InternalPrincipal;
    requestId: string;
  }) {
    return this.prisma.$transaction(
      async (transaction) => {
        const refund = await transaction.refund.findUnique({
          where: { id: input.refundId },
        });
        if (!refund) throw new NotFoundException('Refund not found');
        if (refund.state !== RefundState.REQUESTED) {
          throw new ConflictException('Refund is no longer awaiting approval');
        }
        const approved = await transaction.refund.update({
          where: { id: refund.id },
          data: {
            state: RefundState.APPROVED,
            approvedAt: new Date(),
            approvedById: input.actor.userId,
            safeMetadata: {
              ...(refund.safeMetadata as Prisma.JsonObject),
              approvalReason: input.reason,
            },
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action: 'REFUND_APPROVED',
            entityType: 'REFUND',
            entityId: refund.id,
            reason: input.reason,
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              orderId: refund.orderId,
              paymentAttemptId: refund.paymentAttemptId,
              amountMinor: refund.amountMinor.toString(),
              currency: refund.currency,
            },
          },
        });
        await this.outbox.enqueue(transaction, {
          eventType: 'REFUND_SUBMISSION_REQUIRED',
          aggregateType: 'REFUND',
          aggregateId: refund.id,
          aggregateVersion: 2,
          payload: { refundId: refund.id },
        });
        return approved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async recordProviderOutcome(input: {
    providerReference: string;
    status: string;
  }) {
    const state = input.status.toLowerCase();
    return this.prisma.refund.updateMany({
      where: { providerReference: input.providerReference },
      data: {
        state:
          state === 'processed' || state === 'success'
            ? RefundState.SUCCESS
            : state === 'failed'
              ? RefundState.FAILED
              : RefundState.PENDING,
      },
    });
  }
}

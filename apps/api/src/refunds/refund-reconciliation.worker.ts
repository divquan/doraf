import { Injectable, Logger } from '@nestjs/common';
import { RefundState } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentGatewayService } from '../payments/payment-gateway.service';

@Injectable()
export class RefundReconciliationWorker {
  private readonly logger = new Logger(RefundReconciliationWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const refunds = await this.prisma.refund.findMany({
        where: {
          state: {
            in: [
              RefundState.SUBMITTING,
              RefundState.SUBMITTED,
              RefundState.PENDING,
            ],
          },
          OR: [
            { nextReconciliationAt: null },
            { nextReconciliationAt: { lte: new Date() } },
          ],
        },
        take: 20,
        orderBy: { updatedAt: 'asc' },
        include: { paymentAttempt: true },
      });
      for (const refund of refunds) {
        try {
          const result = refund.providerReference
            ? await this.gateway.fetchRefund(refund.providerReference)
            : await this.gateway.findRefundByTransaction({
                transactionReference: refund.paymentAttempt.providerReference,
                providerTransactionId:
                  refund.paymentAttempt.providerTransactionId,
                amountMinor: refund.amountMinor,
                currency: refund.currency,
                merchantNote: refund.submissionKey ?? `refund-${refund.id}`,
              });
          if (!result) {
            await this.prisma.refund.update({
              where: { id: refund.id },
              data: {
                state: RefundState.PENDING,
                nextReconciliationAt: new Date(Date.now() + 30_000),
                lastError: 'Refund is not yet visible at provider',
              },
            });
            continue;
          }
          await this.prisma.refund.update({
            where: { id: refund.id },
            data: {
              providerReference: result.reference,
              state: stateFromProvider(result.status),
              nextReconciliationAt:
                stateFromProvider(result.status) === RefundState.PENDING
                  ? new Date(Date.now() + 30_000)
                  : null,
              lastError: null,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Refund reconciliation deferred refundId=${refund.id} reason=${error instanceof Error ? error.message.slice(0, 300) : 'unknown'}`,
          );
          throw new Error(`Refund reconciliation failed refundId=${refund.id}`);
        }
      }
    } catch (error) {
      this.logger.error('Refund reconciliation pass failed', error);
      throw error;
    } finally {
      this.running = false;
    }
  }
}

function stateFromProvider(status: string): RefundState {
  if (status === 'processed' || status === 'success')
    return RefundState.SUCCESS;
  if (status === 'failed') return RefundState.FAILED;
  return RefundState.PENDING;
}

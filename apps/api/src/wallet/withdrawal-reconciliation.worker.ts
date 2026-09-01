import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WithdrawalsService } from './withdrawals.service';

@Injectable()
export class WithdrawalReconciliationWorker {
  private readonly logger = new Logger(WithdrawalReconciliationWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const attempts = await this.prisma.transferAttempt.findMany({
        where: {
          providerStatus: {
            in: ['unknown', 'submitting', 'pending', 'processing', 'queued'],
          },
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        select: { providerReference: true },
      });
      for (const attempt of attempts) {
        try {
          await this.withdrawals.reconcileReference(attempt.providerReference);
        } catch (error) {
          this.logger.warn(
            `Transfer reconciliation deferred reference=${attempt.providerReference} reason=${error instanceof Error ? error.message.slice(0, 300) : 'unknown'}`,
          );
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        `Transfer reconciliation scan failed reason=${error instanceof Error ? error.message.slice(0, 300) : 'unknown'}`,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { WithdrawalsService } from './withdrawals.service';

@Injectable()
export class WithdrawalReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WithdrawalReconciliationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly prisma: PrismaService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  onModuleInit() {
    if (
      this.config.get('NODE_ENV', { infer: true }) === 'test' ||
      !this.config.get('WORKER_ENABLED', { infer: true })
    )
      return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

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
        }
      }
    } catch (error) {
      this.logger.error(
        `Transfer reconciliation scan failed reason=${error instanceof Error ? error.message.slice(0, 300) : 'unknown'}`,
      );
    } finally {
      this.running = false;
    }
  }
}

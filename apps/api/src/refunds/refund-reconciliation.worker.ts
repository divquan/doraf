import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefundState } from '../generated/prisma/client';
import type { AppEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { PaymentGatewayService } from '../payments/payment-gateway.service';

@Injectable()
export class RefundReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RefundReconciliationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
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
      const refunds = await this.prisma.refund.findMany({
        where: { state: RefundState.PENDING, providerReference: { not: null } },
        take: 20,
        orderBy: { updatedAt: 'asc' },
      });
      for (const refund of refunds) {
        try {
          const result = await this.gateway.fetchRefund(
            refund.providerReference!,
          );
          await this.prisma.refund.update({
            where: { id: refund.id },
            data: { state: stateFromProvider(result.status) },
          });
        } catch {
          this.logger.warn(
            `Refund reconciliation deferred refundId=${refund.id}`,
          );
        }
      }
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

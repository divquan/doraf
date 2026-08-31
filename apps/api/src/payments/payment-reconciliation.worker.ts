import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { PaymentProviderRequestException } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';
import { isContinuousWorker, isRunOnceWorker } from '../worker-runtime';

const POLL_INTERVAL_MS = 5_000;

/**
 * Continuously verifies durable, due payment attempts. Claiming is persisted
 * on the attempt itself, so concurrent processes and a crash during a provider
 * request cannot create a second charge or lose the reconciliation obligation.
 */
@Injectable()
export class PaymentReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly payments: PaymentProcessingService,
  ) {}

  onModuleInit() {
    if (!isContinuousWorker(this.config)) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), POLL_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Payment reconciliation worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const references = await this.payments.claimDueReconciliationAttempts();
      for (const reference of references) {
        try {
          await this.payments.reconcileDuePayment(reference);
        } catch (error) {
          if (error instanceof PaymentProviderRequestException) continue;
          this.logger.error(
            `Payment reconciliation failed reference=${reference}`,
            error instanceof Error ? error.stack : undefined,
          );
          if (isRunOnceWorker(this.config)) throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        'Payment reconciliation dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (isRunOnceWorker(this.config)) throw error;
    } finally {
      this.running = false;
    }
  }
}

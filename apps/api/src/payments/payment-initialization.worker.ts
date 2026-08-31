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
 * Recovers committed checkout attempts when the request process stops after
 * the order transaction but before Paystack initialization completes. The
 * attempt lease is claimed in the database and the provider reference stays
 * stable across retries.
 */
@Injectable()
export class PaymentInitializationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentInitializationWorker.name);
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
    this.logger.log('Payment initialization worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const references = await this.payments.claimDueInitializationAttempts();
      for (const reference of references) {
        try {
          await this.payments.initializePayment(reference, true);
        } catch (error) {
          if (error instanceof PaymentProviderRequestException) continue;
          this.logger.error(
            `Payment initialization recovery failed reference=${reference}`,
            error instanceof Error ? error.stack : undefined,
          );
          if (isRunOnceWorker(this.config)) throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        'Payment initialization recovery pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (isRunOnceWorker(this.config)) throw error;
    } finally {
      this.running = false;
    }
  }
}

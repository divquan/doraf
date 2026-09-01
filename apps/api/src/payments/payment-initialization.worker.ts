import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderRequestException } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';

/**
 * Recovers committed checkout attempts when the request process stops after
 * the order transaction but before Paystack initialization completes. The
 * attempt lease is claimed in the database and the provider reference stays
 * stable across retries.
 */
@Injectable()
export class PaymentInitializationWorker {
  private readonly logger = new Logger(PaymentInitializationWorker.name);
  private running = false;

  constructor(private readonly payments: PaymentProcessingService) {}

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
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        'Payment initialization recovery pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}

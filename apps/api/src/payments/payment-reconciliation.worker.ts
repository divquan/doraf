import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderRequestException } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';

/**
 * Verifies one bounded batch of durable, due payment attempts. Claiming is
 * persisted on the attempt itself, so concurrent processes and a crash during
 * a provider request cannot create a second charge or lose the reconciliation
 * obligation.
 */
@Injectable()
export class PaymentReconciliationWorker {
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private running = false;

  constructor(private readonly payments: PaymentProcessingService) {}

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
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        'Payment reconciliation dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}

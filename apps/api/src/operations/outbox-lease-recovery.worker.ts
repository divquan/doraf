import { Injectable, Logger } from '@nestjs/common';
import { OUTBOX_CLAIM_LEASE_MS, OutboxService } from './outbox.service';

/**
 * Reclaims work after a worker process dies while holding an outbox claim.
 * This runs only in the dedicated worker process, never in the HTTP process.
 */
@Injectable()
export class OutboxLeaseRecoveryWorker {
  private readonly logger = new Logger(OutboxLeaseRecoveryWorker.name);
  private running = false;

  constructor(private readonly outbox: OutboxService) {}

  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const released = await this.outbox.releaseStaleClaims(
        new Date(Date.now() - OUTBOX_CLAIM_LEASE_MS),
      );
      if (released > 0)
        this.logger.warn(`Requeued ${released} expired outbox claim(s)`);
      return released;
    } catch (error) {
      this.logger.error(
        'Outbox lease recovery pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}

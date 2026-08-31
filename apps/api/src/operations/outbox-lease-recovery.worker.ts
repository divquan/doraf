import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { OUTBOX_CLAIM_LEASE_MS, OutboxService } from './outbox.service';
import { isContinuousWorker } from '../worker-runtime';

const REPAIR_INTERVAL_MS = 30_000;

/**
 * Reclaims work after a worker process dies while holding an outbox claim.
 * This runs only in the dedicated worker process, never in the HTTP process.
 */
@Injectable()
export class OutboxLeaseRecoveryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxLeaseRecoveryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    if (!isContinuousWorker(this.config)) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), REPAIR_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Outbox lease recovery worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

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

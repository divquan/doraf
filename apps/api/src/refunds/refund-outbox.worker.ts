import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { OutboxService } from '../operations/outbox.service';
import { isContinuousWorker, isRunOnceWorker } from '../worker-runtime';
import { RefundOutboxHandler } from './refund-outbox.handler';

@Injectable()
export class RefundOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefundOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly handler: RefundOutboxHandler,
  ) {}

  onModuleInit() {
    if (
      this.config.get('QUEUE_PROVIDER', { infer: true }) === 'redis' ||
      !isContinuousWorker(this.config)
    )
      return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        10,
        claimToken,
        ['REFUND_SUBMISSION_REQUIRED'],
      );
      for (const event of events)
        await this.handler.handleClaimed(event.id, claimToken);
    } catch (error) {
      this.logger.error('Refund submission dispatch failed', error);
      if (isRunOnceWorker(this.config)) throw error;
    } finally {
      this.running = false;
    }
  }
}

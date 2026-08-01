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
import { WithdrawalOutboxHandler } from './withdrawal-outbox.handler';

@Injectable()
export class WithdrawalOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WithdrawalOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly handler: WithdrawalOutboxHandler,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    void this.dispatch();
    this.timer = setInterval(() => void this.dispatch(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async dispatch() {
    if (this.running) return;
    this.running = true;
    try {
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        10,
        claimToken,
        ['WITHDRAWAL_SUBMISSION_REQUIRED'],
      );
      for (const event of events)
        await this.handler.handleClaimed(event.id, claimToken);
    } catch (error) {
      this.logger.error('Withdrawal submission dispatch failed', error);
    } finally {
      this.running = false;
    }
  }
}

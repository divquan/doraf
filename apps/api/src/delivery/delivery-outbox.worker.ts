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
import { DeliveryOutboxHandler } from './delivery-outbox.handler';

const POLL_INTERVAL_MS = 1_000;
const CLAIM_LEASE_MS = 2 * 60_000;

@Injectable()
export class DeliveryOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly handler: DeliveryOutboxHandler,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'development') return;
    void this.dispatch();
    this.timer = setInterval(() => void this.dispatch(), POLL_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Development delivery outbox worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async dispatch() {
    if (this.running) return;
    this.running = true;
    try {
      await this.outbox.releaseStaleClaims(
        new Date(Date.now() - CLAIM_LEASE_MS),
      );
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        20,
        claimToken,
        ['DELIVERY_MESSAGE_REQUESTED'],
      );
      for (const event of events) {
        await this.handler.handleClaimed(event.id, claimToken);
      }
    } catch (error) {
      this.logger.error('Delivery outbox dispatch pass failed', error);
    } finally {
      this.running = false;
    }
  }
}

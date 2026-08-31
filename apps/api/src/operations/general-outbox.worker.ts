import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { OutboxService } from './outbox.service';

const POLL_INTERVAL_MS = 5_000;

// Domain informational outbox events that do not require external API calls (e.g. Paystack / SMS)
const INFORMATIONAL_EVENT_TYPES = [
  'PRODUCT_PRICING_POLICY_CREATED',
  'AGENT_PRICING_OVERRIDE_CREATED',
  'AGENT_PRICING_OVERRIDE_CLOSED',
  'AGENT_RETAIL_PRICE_SET',
  'PAYMENT_INITIALIZATION_REQUESTED',
  'RESERVATION_EXPIRY_DUE',
];

@Injectable()
export class GeneralOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeneralOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    if (
      this.config.get('NODE_ENV', { infer: true }) === 'test' ||
      this.config.get('QUEUE_PROVIDER', { infer: true }) === 'redis' ||
      !this.config.get('WORKER_ENABLED', { infer: true })
    )
      return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), POLL_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('General outbox worker started');
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
        25,
        claimToken,
        INFORMATIONAL_EVENT_TYPES,
      );

      for (const event of events) {
        try {
          await this.outbox.markDispatched(event.id, claimToken);
          this.logger.debug(
            `Dispatched informational outbox event ${event.eventType} id=${event.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to mark informational outbox event dispatched id=${event.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'General outbox dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}

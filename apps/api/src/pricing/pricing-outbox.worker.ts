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
import { PricingOutboxHandler } from './pricing-outbox.handler';

const POLL_INTERVAL_MS = 5_000;
const PRICING_EVENT_TYPES = [
  'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
  'AGENT_PRICING_OVERRIDE_ACTIVATION_DUE',
];

@Injectable()
export class PricingOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PricingOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly handler: PricingOutboxHandler,
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
    this.logger.log('Pricing outbox worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        25,
        claimToken,
        PRICING_EVENT_TYPES,
      );
      for (const event of events)
        await this.handler.handleClaimed(event.id, claimToken);
    } catch (error) {
      this.logger.error(
        'Pricing outbox dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}

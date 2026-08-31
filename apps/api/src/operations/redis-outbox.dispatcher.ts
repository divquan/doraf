import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { REDIS_OUTBOX_EVENT_TYPES } from './outbox-event-types';
import { OutboxService } from './outbox.service';
import { RedisOutboxQueue } from './redis-outbox.queue';
import {
  isContinuousWorker,
  isQueueWorkerEnabled,
  isRunOnceWorker,
} from '../worker-runtime';

const DISPATCH_INTERVAL_MS = 1_000;

@Injectable()
export class RedisOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisOutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly queue: RedisOutboxQueue,
  ) {}

  onModuleInit() {
    if (!this.enabled() || !isContinuousWorker(this.config)) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), DISPATCH_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Redis outbox dispatcher started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running || !this.enabled()) return;
    this.running = true;
    try {
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        25,
        claimToken,
        REDIS_OUTBOX_EVENT_TYPES.filter(
          (eventType) =>
            eventType !== 'DELIVERY_MESSAGE_REQUESTED' ||
            this.config.get('NODE_ENV', { infer: true }) === 'development',
        ),
      );
      for (const event of events) {
        try {
          await this.queue.publish({
            eventId: event.id,
            claimToken,
            eventType: event.eventType,
          });
          await this.outbox.markQueued(event.id, claimToken);
        } catch (error) {
          await this.reschedulePublishFailure(event.id, claimToken, error);
        }
      }
    } catch (error) {
      this.logger.error(
        'Redis outbox dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (isRunOnceWorker(this.config)) throw error;
    } finally {
      this.running = false;
    }
  }

  private async reschedulePublishFailure(
    eventId: string,
    claimToken: string,
    error: unknown,
  ) {
    try {
      await this.outbox.reschedule(eventId, claimToken, {
        availableAt: new Date(Date.now() + 5_000),
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Redis publish failed',
      });
    } catch (rescheduleError) {
      this.logger.error(
        `Could not reschedule Redis outbox event id=${eventId}`,
        rescheduleError instanceof Error ? rescheduleError.stack : undefined,
      );
    }
  }

  private enabled(): boolean {
    return isQueueWorkerEnabled(this.config);
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxState } from '../generated/prisma/client';
import type { AppEnvironment } from '../config/environment';
import { DeliveryOutboxHandler } from '../delivery/delivery-outbox.handler';
import { INFORMATIONAL_OUTBOX_EVENT_TYPES } from './outbox-event-types';
import { OutboxService } from './outbox.service';
import {
  RedisOutboxQueue,
  type RedisOutboxMessage,
} from './redis-outbox.queue';
import { PricingOutboxHandler } from '../pricing/pricing-outbox.handler';
import { RefundOutboxHandler } from '../refunds/refund-outbox.handler';
import { WithdrawalOutboxHandler } from '../wallet/withdrawal-outbox.handler';
import {
  isContinuousWorker,
  isQueueWorkerEnabled,
  isRunOnceWorker,
} from '../worker-runtime';

@Injectable()
export class RedisOutboxConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisOutboxConsumer.name);
  private stopping = false;
  private consumeTask?: Promise<void>;
  private readonly consumerName: string;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly queue: RedisOutboxQueue,
    private readonly outbox: OutboxService,
    private readonly delivery: DeliveryOutboxHandler,
    private readonly pricing: PricingOutboxHandler,
    private readonly refunds: RefundOutboxHandler,
    private readonly withdrawals: WithdrawalOutboxHandler,
  ) {
    this.consumerName = queue.createConsumerName();
  }

  onModuleInit() {
    if (!this.enabled() || !isContinuousWorker(this.config)) return;
    this.consumeTask = this.consume();
    this.logger.log(`Redis outbox consumer started name=${this.consumerName}`);
  }

  async onModuleDestroy() {
    this.stopping = true;
    await this.consumeTask;
  }

  private async consume(): Promise<void> {
    while (!this.stopping) {
      try {
        await this.runOnce();
      } catch (error) {
        this.logger.error(
          'Redis outbox consume pass failed',
          error instanceof Error ? error.stack : undefined,
        );
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }

  async runOnce(): Promise<void> {
    if (!this.enabled()) return;
    const pending = await this.queue.claimPending(this.consumerName);
    await this.processAll(pending);
    if (this.stopping) return;
    const fresh = await this.queue.readNew(this.consumerName);
    await this.processAll(fresh);
  }

  private async processAll(messages: RedisOutboxMessage[]): Promise<void> {
    for (const message of messages) await this.processOne(message);
  }

  private async processOne(message: RedisOutboxMessage): Promise<void> {
    try {
      const event = await this.outbox.getClaimedEvent(
        message.eventId,
        message.claimToken,
      );
      if (!event) {
        await this.queue.acknowledge(message.streamId);
        return;
      }
      await this.dispatch(event.eventType, message);
      await this.queue.acknowledge(message.streamId);
    } catch (error) {
      const current = await this.outbox.getState(message.eventId);
      if (
        !current ||
        (current.state !== OutboxState.CLAIMED &&
          current.state !== OutboxState.QUEUED)
      ) {
        await this.queue.acknowledge(message.streamId);
        return;
      }
      this.logger.error(
        `Redis outbox event deferred id=${message.eventId}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (isRunOnceWorker(this.config)) throw error;
    }
  }

  private async dispatch(
    eventType: string,
    message: RedisOutboxMessage,
  ): Promise<void> {
    if (
      (INFORMATIONAL_OUTBOX_EVENT_TYPES as readonly string[]).includes(
        eventType,
      )
    ) {
      await this.outbox.markDispatched(message.eventId, message.claimToken);
      return;
    }
    if (
      eventType === 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE' ||
      eventType === 'AGENT_PRICING_OVERRIDE_ACTIVATION_DUE'
    ) {
      await this.pricing.handleClaimed(message.eventId, message.claimToken);
      return;
    }
    if (eventType === 'REFUND_SUBMISSION_REQUIRED') {
      await this.refunds.handleClaimed(message.eventId, message.claimToken);
      return;
    }
    if (eventType === 'WITHDRAWAL_SUBMISSION_REQUIRED') {
      await this.withdrawals.handleClaimed(message.eventId, message.claimToken);
      return;
    }
    if (eventType === 'DELIVERY_MESSAGE_REQUESTED') {
      if (this.config.get('NODE_ENV', { infer: true }) !== 'development') {
        await this.outbox.reschedule(message.eventId, message.claimToken, {
          availableAt: new Date(),
          error: 'production delivery gateway is not configured',
          terminal: true,
        });
        return;
      }
      await this.delivery.handleClaimed(message.eventId, message.claimToken);
      return;
    }
    await this.outbox.reschedule(message.eventId, message.claimToken, {
      availableAt: new Date(),
      error: `No Redis outbox handler for event type ${eventType}`,
      terminal: true,
    });
  }

  private enabled(): boolean {
    return isQueueWorkerEnabled(this.config);
  }
}

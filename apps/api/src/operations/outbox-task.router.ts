import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { DeliveryOutboxHandler } from '../delivery/delivery-outbox.handler';
import { PricingOutboxHandler } from '../pricing/pricing-outbox.handler';
import { RefundOutboxHandler } from '../refunds/refund-outbox.handler';
import { WithdrawalOutboxHandler } from '../wallet/withdrawal-outbox.handler';
import { INFORMATIONAL_OUTBOX_EVENT_TYPES } from './outbox-event-types';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxTaskRouter {
  private readonly logger = new Logger(OutboxTaskRouter.name);

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: OutboxService,
    private readonly pricing: PricingOutboxHandler,
    private readonly refunds: RefundOutboxHandler,
    private readonly withdrawals: WithdrawalOutboxHandler,
    private readonly delivery: DeliveryOutboxHandler,
  ) {}

  async handle(input: { eventId: string; claimToken: string }): Promise<void> {
    const event = await this.outbox.getClaimedEvent(
      input.eventId,
      input.claimToken,
    );
    if (!event) {
      this.logger.log(
        `Stale or already dispatched task eventId=${input.eventId} claimToken=${input.claimToken}`,
      );
      return;
    }

    // Never trust body eventType, use DB value
    const eventType = event.eventType;

    if (
      (INFORMATIONAL_OUTBOX_EVENT_TYPES as readonly string[]).includes(
        eventType,
      )
    ) {
      await this.outbox.markDispatched(input.eventId, input.claimToken);
      return;
    }

    if (
      eventType === 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE' ||
      eventType === 'AGENT_PRICING_OVERRIDE_ACTIVATION_DUE'
    ) {
      await this.pricing.handleClaimed(input.eventId, input.claimToken);
      return;
    }

    if (eventType === 'REFUND_SUBMISSION_REQUIRED') {
      await this.refunds.handleClaimed(input.eventId, input.claimToken);
      return;
    }

    if (eventType === 'WITHDRAWAL_SUBMISSION_REQUIRED') {
      await this.withdrawals.handleClaimed(input.eventId, input.claimToken);
      return;
    }

    if (eventType === 'DELIVERY_MESSAGE_REQUESTED') {
      const nodeEnv = this.config.get('NODE_ENV', { infer: true });
      const hasHubtel = Boolean(
        this.config.get('HUBTEL_CLIENT_ID', { infer: true }),
      );
      const hasLoops = Boolean(
        this.config.get('LOOPS_API_KEY', { infer: true }),
      );
      if (nodeEnv !== 'development' && !hasHubtel && !hasLoops) {
        await this.outbox.reschedule(input.eventId, input.claimToken, {
          availableAt: new Date(),
          error: 'production delivery gateway is not configured',
          terminal: true,
        });
        return;
      }
      await this.delivery.handleClaimed(input.eventId, input.claimToken);
      return;
    }

    await this.outbox.reschedule(input.eventId, input.claimToken, {
      availableAt: new Date(),
      error: `No outbox handler for event type ${eventType}`,
      terminal: true,
    });
  }
}

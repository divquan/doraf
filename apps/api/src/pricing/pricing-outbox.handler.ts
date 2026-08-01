import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../operations/outbox.service';
import { PricingService } from './pricing.service';

@Injectable()
export class PricingOutboxHandler {
  private readonly logger = new Logger(PricingOutboxHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly outbox: OutboxService,
  ) {}

  async handleClaimed(eventId: string, claimToken: string): Promise<boolean> {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { id: eventId, claimToken, state: 'CLAIMED' },
    });
    if (!event) return false;

    if (event.eventType === 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE') {
      const count = await this.pricing.applyScheduledDefaultPolicy(
        event.aggregateId,
      );
      this.logger.log(
        `Applied scheduled pricing policy ${event.aggregateId}; clamped=${count}`,
      );
    } else if (event.eventType === 'AGENT_PRICING_OVERRIDE_ACTIVATION_DUE') {
      const count = await this.pricing.applyScheduledOverride(
        event.aggregateId,
      );
      this.logger.log(
        `Applied scheduled pricing override ${event.aggregateId}; clamped=${count}`,
      );
    } else {
      return false;
    }
    await this.outbox.markDispatched(event.id, claimToken);
    return true;
  }
}

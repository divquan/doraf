import { Injectable, Logger } from '@nestjs/common';
import { OutboxState } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../operations/outbox.service';
import { WithdrawalsService } from './withdrawals.service';

@Injectable()
export class WithdrawalOutboxHandler {
  private readonly logger = new Logger(WithdrawalOutboxHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  async handleClaimed(eventId: string, claimToken: string) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: eventId,
        claimToken,
        state: OutboxState.CLAIMED,
        eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED',
      },
    });
    if (!event) return false;
    try {
      await this.withdrawals.submitApproved(event.aggregateId);
    } catch (error) {
      this.logger.warn(
        `Withdrawal submission deferred withdrawalId=${event.aggregateId} reason=${error instanceof Error ? error.message.slice(0, 300) : 'unknown'}`,
      );
      await this.outbox.reschedule(event.id, claimToken, {
        availableAt: new Date(
          Date.now() + Math.min(60_000, 2 ** event.attemptCount * 1_000),
        ),
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Unknown error',
        terminal: event.attemptCount >= 20,
      });
      return true;
    }
    await this.outbox.markDispatched(event.id, claimToken);
    return true;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OUTBOX_EVENT_TYPES } from './outbox-event-types';
import { OutboxService } from './outbox.service';
import { CloudTasksOutboxPublisher } from './cloud-tasks-outbox.publisher';

@Injectable()
export class CloudTasksOutboxDispatcher {
  private readonly logger = new Logger(CloudTasksOutboxDispatcher.name);
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly publisher: CloudTasksOutboxPublisher,
  ) {}

  /**
   * Request-safe bounded publication. Claims at most 25 events,
   * creates one Cloud Task per claim, marks QUEUED only after acceptance,
   * and reschedules only the failed claim. Continues batch despite single failure.
   * Safe to call from HTTP post-commit hook and from scheduled repair job.
   */
  async publishPending(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const claimToken = randomUUID();
      const events = await this.outbox.claimAvailableForEventTypes(
        25,
        claimToken,
        [...OUTBOX_EVENT_TYPES],
      );
      for (const event of events) {
        try {
          await this.publisher.publish({
            eventId: event.id,
            claimToken,
            eventType: event.eventType,
          });
          await this.outbox.markQueued(event.id, claimToken);
        } catch (error) {
          await this.reschedulePublishFailure(event.id, claimToken, error);
        }
      }
      return events.length;
    } catch (error) {
      this.logger.error(
        'Cloud Tasks outbox dispatch pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }

  /**
   * Alias for backwards compatibility with Redis dispatcher naming.
   */
  async runOnce(): Promise<number> {
    return this.publishPending();
  }

  /**
   * Fire-and-forget hook for post-commit publishing.
   * Never throws to caller; logs and lets repair job retry.
   */
  async trigger(): Promise<void> {
    try {
      await this.publishPending();
    } catch (error) {
      this.logger.warn(
        `Cloud Tasks post-commit publishing deferred: ${safeError(error)}`,
      );
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
            : 'Cloud Tasks publish failed',
      });
    } catch (rescheduleError) {
      this.logger.error(
        `Could not reschedule Cloud Tasks outbox event id=${eventId}`,
        rescheduleError instanceof Error ? rescheduleError.stack : undefined,
      );
    }
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Cloud Tasks publish failed';
}

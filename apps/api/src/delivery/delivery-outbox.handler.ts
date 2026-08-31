import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryAttemptState,
  DeliveryMessageState,
  OutboxState,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OrderContactProtectionService } from '../orders/order-contact-protection.service';
import { OutboxService } from '../operations/outbox.service';
import {
  DeliverySubmissionError,
  DevelopmentDeliveryGateway,
} from './delivery-gateway.service';

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;
const MAX_SUBMISSIONS = 4;

@Injectable()
export class DeliveryOutboxHandler {
  private readonly logger = new Logger(DeliveryOutboxHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: OrderContactProtectionService,
    private readonly gateway: DevelopmentDeliveryGateway,
    private readonly outbox: OutboxService,
  ) {}

  async handleClaimed(eventId: string, claimToken: string): Promise<boolean> {
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: eventId,
        claimToken,
        state: { in: [OutboxState.CLAIMED, OutboxState.QUEUED] },
        eventType: 'DELIVERY_MESSAGE_REQUESTED',
      },
    });
    if (!event) return false;

    const message = await this.prisma.deliveryMessage.findUnique({
      where: { id: event.aggregateId },
      include: { attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
    });
    if (!message) {
      await this.outbox.reschedule(event.id, claimToken, {
        availableAt: new Date(),
        error: 'delivery message missing',
        terminal: true,
      });
      return true;
    }
    if (
      message.state === DeliveryMessageState.SUBMITTED ||
      message.state === DeliveryMessageState.DELIVERED
    ) {
      await this.outbox.markDispatched(event.id, claimToken);
      return true;
    }
    if (message.state === DeliveryMessageState.UNKNOWN) {
      await this.outbox.reschedule(event.id, claimToken, {
        availableAt: new Date(),
        error: 'delivery outcome requires provider reconciliation',
        terminal: true,
      });
      return true;
    }

    const attempt = await this.getOrCreateAttempt(
      message.id,
      message.attemptCount,
      message.stableClientReference,
      message.attempts[0]?.state,
    );
    try {
      const destination =
        message.channel === 'SMS'
          ? this.contacts.revealPhone(message.destinationCiphertext, 'delivery')
          : this.contacts.revealEmail(
              message.destinationCiphertext,
              'delivery',
            );
      const submitted = await this.gateway.submit({
        channel: message.channel,
        destination,
        destinationMask: message.destinationMask,
        stableClientReference: attempt.stableClientReference,
      });
      await this.prisma.$transaction(async (transaction) => {
        await transaction.deliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            state: DeliveryAttemptState.SUBMITTED,
            provider: submitted.provider,
            providerMessageReference: submitted.providerMessageReference,
            safeMetadata: submitted.safeMetadata,
            submittedAt: new Date(),
          },
        });
        await transaction.deliveryMessage.update({
          where: { id: message.id },
          data: { state: DeliveryMessageState.SUBMITTED, nextAttemptAt: null },
        });
      });
      await this.outbox.markDispatched(event.id, claimToken);
      return true;
    } catch (error) {
      await this.recordFailure(
        event.id,
        claimToken,
        message.id,
        attempt.id,
        error,
      );
      return true;
    }
  }

  private async getOrCreateAttempt(
    messageId: string,
    expectedAttemptCount: number,
    stableMessageReference: string,
    latestState?: DeliveryAttemptState,
  ) {
    if (latestState === DeliveryAttemptState.PENDING) {
      return this.prisma.deliveryAttempt.findFirstOrThrow({
        where: { deliveryMessageId: messageId },
        orderBy: { attemptNumber: 'desc' },
      });
    }
    const attemptNumber = expectedAttemptCount + 1;
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.deliveryMessage.updateMany({
        where: {
          id: messageId,
          attemptCount: expectedAttemptCount,
          state: {
            in: [DeliveryMessageState.PENDING, DeliveryMessageState.FAILED],
          },
        },
        data: { attemptCount: attemptNumber, nextAttemptAt: null },
      });
      if (result.count === 0) {
        return transaction.deliveryAttempt.findFirstOrThrow({
          where: { deliveryMessageId: messageId },
          orderBy: { attemptNumber: 'desc' },
        });
      }
      return transaction.deliveryAttempt.create({
        data: {
          deliveryMessageId: messageId,
          attemptNumber,
          stableClientReference: `${stableMessageReference}-attempt-${attemptNumber}`,
          provider: 'development',
        },
      });
    });
  }

  private async recordFailure(
    eventId: string,
    claimToken: string,
    messageId: string,
    attemptId: string,
    error: unknown,
  ) {
    const failure =
      error instanceof DeliverySubmissionError
        ? error
        : new DeliverySubmissionError(
            'AMBIGUOUS',
            'submission outcome unknown',
          );
    const attempt = await this.prisma.deliveryAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { attemptNumber: true },
    });
    const terminal =
      failure.classification === 'AMBIGUOUS' ||
      attempt.attemptNumber >= MAX_SUBMISSIONS;
    const nextAttemptAt = terminal
      ? null
      : new Date(Date.now() + RETRY_DELAYS_MS[attempt.attemptNumber - 1]);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.deliveryAttempt.update({
        where: { id: attemptId },
        data: {
          state:
            failure.classification === 'AMBIGUOUS'
              ? DeliveryAttemptState.UNKNOWN
              : DeliveryAttemptState.FAILED,
          failureClassification: failure.classification,
        },
      });
      await transaction.deliveryMessage.update({
        where: { id: messageId },
        data: {
          state:
            failure.classification === 'AMBIGUOUS'
              ? DeliveryMessageState.UNKNOWN
              : terminal
                ? DeliveryMessageState.FAILED
                : DeliveryMessageState.PENDING,
          nextAttemptAt,
        },
      });
    });
    await this.outbox.reschedule(eventId, claimToken, {
      availableAt: nextAttemptAt ?? new Date(),
      error: `delivery ${failure.classification.toLowerCase()}: ${failure.safeCode}`,
      terminal,
    });
    this.logger.warn(
      `Delivery submission ${failure.classification.toLowerCase()} messageId=${messageId} attempt=${attempt.attemptNumber} code=${failure.safeCode}`,
    );
  }
}

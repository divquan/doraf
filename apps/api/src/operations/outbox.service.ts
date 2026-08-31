import { ConflictException, Injectable } from '@nestjs/common';
import {
  InternalRole,
  OutboxEvent,
  OutboxState,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

export const OUTBOX_CLAIM_LEASE_MS = 2 * 60_000;
const OUTBOX_RETRY_DELAY_MS = 5_000;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(
    transaction: Prisma.TransactionClient,
    input: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      aggregateVersion: number;
      payload?: Prisma.InputJsonValue;
      availableAt?: Date;
    },
  ) {
    return transaction.outboxEvent.create({
      data: { ...input, payload: input.payload ?? {} },
    });
  }

  claimAvailable(limit: number, claimToken: string) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.$transaction(
      (transaction) => transaction.$queryRaw<OutboxEvent[]>`
      WITH candidates AS (
        SELECT id FROM outbox_event
        WHERE state = 'PENDING' AND available_at <= CURRENT_TIMESTAMP
        ORDER BY available_at, created_at
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_event AS event
      SET state = 'CLAIMED', claimed_at = CURRENT_TIMESTAMP,
          lease_until = CURRENT_TIMESTAMP + ${OUTBOX_CLAIM_LEASE_MS} * INTERVAL '1 millisecond',
          claim_token = ${claimToken}::uuid, attempt_count = attempt_count + 1
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.id,
                event.event_type AS "eventType",
                event.aggregate_type AS "aggregateType",
                event.aggregate_id AS "aggregateId",
                event.aggregate_version AS "aggregateVersion",
                event.payload,
                event.state,
                event.attempt_count AS "attemptCount",
                event.available_at AS "availableAt",
                event.claimed_at AS "claimedAt",
                event.lease_until AS "leaseUntil",
                event.claim_token AS "claimToken",
                event.dispatched_at AS "dispatchedAt",
                event.last_error AS "lastError",
                event.created_at AS "createdAt"
    `,
    );
  }

  claimAvailableForEventTypes(
    limit: number,
    claimToken: string,
    eventTypes: string[],
  ) {
    if (eventTypes.length === 0) return Promise.resolve([]);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.$transaction(
      (transaction) => transaction.$queryRaw<OutboxEvent[]>`
      WITH candidates AS (
        SELECT id FROM outbox_event
        WHERE state = 'PENDING' AND available_at <= CURRENT_TIMESTAMP
          AND event_type IN (${Prisma.join(eventTypes)})
        ORDER BY available_at, created_at
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_event AS event
      SET state = 'CLAIMED', claimed_at = CURRENT_TIMESTAMP,
          lease_until = CURRENT_TIMESTAMP + ${OUTBOX_CLAIM_LEASE_MS} * INTERVAL '1 millisecond',
          claim_token = ${claimToken}::uuid, attempt_count = attempt_count + 1
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.id,
                event.event_type AS "eventType",
                event.aggregate_type AS "aggregateType",
                event.aggregate_id AS "aggregateId",
                event.aggregate_version AS "aggregateVersion",
                event.payload,
                event.state,
                event.attempt_count AS "attemptCount",
                event.available_at AS "availableAt",
                event.claimed_at AS "claimedAt",
                event.lease_until AS "leaseUntil",
                event.claim_token AS "claimToken",
                event.dispatched_at AS "dispatchedAt",
                event.last_error AS "lastError",
                event.created_at AS "createdAt"
    `,
    );
  }

  async markDispatched(id: string, claimToken: string): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        state: { in: [OutboxState.CLAIMED, OutboxState.QUEUED] },
        claimToken,
      },
      data: {
        state: OutboxState.DISPATCHED,
        claimedAt: null,
        leaseUntil: null,
        claimToken: null,
        dispatchedAt: new Date(),
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Outbox claim is no longer active');
  }

  async markQueued(id: string, claimToken: string): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, state: OutboxState.CLAIMED, claimToken },
      data: { state: OutboxState.QUEUED },
    });
    return result.count === 1;
  }

  async reschedule(
    id: string,
    claimToken: string,
    input: { availableAt: Date; error: string; terminal?: boolean },
  ): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        state: { in: [OutboxState.CLAIMED, OutboxState.QUEUED] },
        claimToken,
      },
      data: input.terminal
        ? {
            state: OutboxState.FAILED,
            claimedAt: null,
            leaseUntil: null,
            claimToken: null,
            lastError: input.error,
          }
        : {
            state: OutboxState.PENDING,
            claimedAt: null,
            leaseUntil: null,
            claimToken: null,
            availableAt: input.availableAt,
            lastError: input.error,
          },
    });
    if (result.count !== 1)
      throw new ConflictException('Outbox claim is no longer active');
  }

  async releaseStaleClaims(claimedBefore: Date): Promise<number> {
    const reclaimed = await this.reclaimExpiredClaims({ claimedBefore });
    return reclaimed.length;
  }

  async reclaimExpiredClaims(input: {
    claimedBefore: Date;
    audit?: {
      actorInternalUserId: string;
      actorRole: InternalRole;
      authenticationStrength: string;
      requestId: string;
      reason: string;
    };
  }): Promise<OutboxEvent[]> {
    return this.prisma.$transaction(async (transaction) => {
      const reclaimed = await transaction.$queryRaw<OutboxEvent[]>`
        WITH candidates AS (
          SELECT id
          FROM outbox_event
          WHERE state IN ('CLAIMED', 'QUEUED')
            AND (
              lease_until <= CURRENT_TIMESTAMP
              OR (lease_until IS NULL AND claimed_at < ${input.claimedBefore})
            )
          ORDER BY COALESCE(lease_until, claimed_at), created_at
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_event AS event
        SET state = 'PENDING',
            claimed_at = NULL,
            lease_until = NULL,
            claim_token = NULL,
            available_at = CURRENT_TIMESTAMP + ${OUTBOX_RETRY_DELAY_MS} * INTERVAL '1 millisecond',
            last_error = 'Outbox claim lease expired; retry scheduled'
        FROM candidates
        WHERE event.id = candidates.id
        RETURNING event.id,
                  event.event_type AS "eventType",
                  event.aggregate_type AS "aggregateType",
                  event.aggregate_id AS "aggregateId",
                  event.aggregate_version AS "aggregateVersion",
                  event.payload,
                  event.state,
                  event.attempt_count AS "attemptCount",
                  event.available_at AS "availableAt",
                  event.claimed_at AS "claimedAt",
                  event.lease_until AS "leaseUntil",
                  event.claim_token AS "claimToken",
                  event.dispatched_at AS "dispatchedAt",
                  event.last_error AS "lastError",
                  event.created_at AS "createdAt"
      `;

      if (input.audit && reclaimed.length > 0) {
        await transaction.auditEvent.createMany({
          data: reclaimed.map((event) => ({
            actorInternalUserId: input.audit!.actorInternalUserId,
            actorRole: input.audit!.actorRole,
            action: 'OUTBOX_CLAIM_REQUEUED',
            entityType: 'OUTBOX_EVENT',
            entityId: event.id,
            reason: input.audit!.reason,
            authenticationStrength: input.audit!.authenticationStrength,
            requestId: input.audit!.requestId,
            safeMetadata: {
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              attemptCount: event.attemptCount,
            },
          })),
        });
      }
      return reclaimed;
    });
  }

  async getClaimedEvent(id: string, claimToken: string) {
    return this.prisma.outboxEvent.findFirst({
      where: {
        id,
        claimToken,
        state: { in: [OutboxState.CLAIMED, OutboxState.QUEUED] },
      },
      select: { eventType: true, state: true },
    });
  }

  async getState(id: string) {
    return this.prisma.outboxEvent.findUnique({
      where: { id },
      select: { state: true },
    });
  }
}

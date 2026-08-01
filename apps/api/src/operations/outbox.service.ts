import { ConflictException, Injectable } from '@nestjs/common';
import { OutboxState, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

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
    },
  ) {
    return transaction.outboxEvent.create({
      data: { ...input, payload: input.payload ?? {} },
    });
  }

  claimAvailable(limit: number, claimToken: string) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.$transaction(
      (transaction) => transaction.$queryRaw`
      WITH candidates AS (
        SELECT id FROM outbox_event
        WHERE state = 'PENDING' AND available_at <= CURRENT_TIMESTAMP
        ORDER BY available_at, created_at
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_event AS event
      SET state = 'CLAIMED', claimed_at = CURRENT_TIMESTAMP,
          claim_token = ${claimToken}::uuid, attempt_count = attempt_count + 1
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.*
    `,
    );
  }

  async markDispatched(id: string, claimToken: string): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, state: OutboxState.CLAIMED, claimToken },
      data: { state: OutboxState.DISPATCHED, dispatchedAt: new Date() },
    });
    if (result.count !== 1)
      throw new ConflictException('Outbox claim is no longer active');
  }

  async reschedule(
    id: string,
    claimToken: string,
    input: { availableAt: Date; error: string; terminal?: boolean },
  ): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, state: OutboxState.CLAIMED, claimToken },
      data: input.terminal
        ? { state: OutboxState.FAILED, lastError: input.error }
        : {
            state: OutboxState.PENDING,
            claimedAt: null,
            claimToken: null,
            availableAt: input.availableAt,
            lastError: input.error,
          },
    });
    if (result.count !== 1)
      throw new ConflictException('Outbox claim is no longer active');
  }
}

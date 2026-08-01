import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(input: {
    scope: string;
    key: string;
    operation: string;
    requestFingerprint: Uint8Array;
    expiresAt: Date;
  }) {
    try {
      return {
        acquired: true,
        record: await this.prisma.idempotencyRecord.create({
          data: {
            ...input,
            requestFingerprint: Buffer.from(input.requestFingerprint),
          },
        }),
      };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const record = await this.prisma.idempotencyRecord.findUnique({
        where: { scope_key: { scope: input.scope, key: input.key } },
      });
      if (
        !record ||
        !Buffer.from(record.requestFingerprint).equals(
          Buffer.from(input.requestFingerprint),
        ) ||
        record.operation !== input.operation
      ) {
        throw new ConflictException(
          'Idempotency key is already bound to a different request',
        );
      }
      if (!record.outcomeReference)
        throw new ConflictException(
          'An identical request is already in progress',
        );
      return { acquired: false, record };
    }
  }

  async complete(id: string, outcomeReference: string): Promise<void> {
    const result = await this.prisma.idempotencyRecord.updateMany({
      where: { id, outcomeReference: null },
      data: { outcomeReference },
    });
    if (result.count !== 1)
      throw new ConflictException('Idempotency outcome is already recorded');
  }

  async acquireInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      scope: string;
      key: string;
      operation: string;
      requestFingerprint: Uint8Array;
      expiresAt: Date;
    },
  ) {
    const id = randomUUID();
    const inserted = await transaction.$executeRaw`
      INSERT INTO idempotency_record
        (id, scope, key, operation, request_fingerprint, expires_at)
      VALUES
        (${id}::uuid, ${input.scope}, ${input.key}, ${input.operation},
         ${Buffer.from(input.requestFingerprint)}, ${input.expiresAt})
      ON CONFLICT (scope, key) DO NOTHING
    `;
    const record = await transaction.idempotencyRecord.findUniqueOrThrow({
      where: { scope_key: { scope: input.scope, key: input.key } },
    });
    if (
      record.operation !== input.operation ||
      !Buffer.from(record.requestFingerprint).equals(
        Buffer.from(input.requestFingerprint),
      )
    ) {
      throw new ConflictException(
        'Idempotency key is already bound to a different request',
      );
    }
    if (inserted === 0 && !record.outcomeReference) {
      throw new ConflictException(
        'An identical request is already in progress',
      );
    }
    return { acquired: inserted === 1, record };
  }

  async completeInTransaction(
    transaction: Prisma.TransactionClient,
    id: string,
    outcomeReference: string,
  ): Promise<void> {
    const result = await transaction.idempotencyRecord.updateMany({
      where: { id, outcomeReference: null },
      data: { outcomeReference },
    });
    if (result.count !== 1)
      throw new ConflictException('Idempotency outcome is already recorded');
  }
}

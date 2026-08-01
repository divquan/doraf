import { ConflictException, Injectable } from '@nestjs/common';
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
}

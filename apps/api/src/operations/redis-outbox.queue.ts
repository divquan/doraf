import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';

export const REDIS_OUTBOX_STREAM = 'dashchecker:outbox';
export const REDIS_OUTBOX_GROUP = 'dashchecker:outbox-workers';
export const REDIS_OUTBOX_PENDING_IDLE_MS = 60_000;

export interface RedisOutboxMessage {
  streamId: string;
  eventId: string;
  claimToken: string;
}

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisOutboxQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisOutboxQueue.name);
  private readonly client: RedisClient;

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {
    this.client = createClient({
      url: config.get('REDIS_URL', { infer: true }) ?? undefined,
    });
    this.client.on('error', (error) => {
      this.logger.error(
        'Redis outbox client error',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled()) return;
    await this.connect();
    try {
      await this.client.xGroupCreate(
        REDIS_OUTBOX_STREAM,
        REDIS_OUTBOX_GROUP,
        '0',
        { MKSTREAM: true },
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP'))
        throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  async publish(input: {
    eventId: string;
    claimToken: string;
    eventType: string;
  }): Promise<string> {
    await this.ensureConnected();
    return this.client.xAdd(REDIS_OUTBOX_STREAM, '*', {
      eventId: input.eventId,
      claimToken: input.claimToken,
      eventType: input.eventType,
    });
  }

  async readNew(consumerName: string): Promise<RedisOutboxMessage[]> {
    await this.ensureConnected();
    const streams = await this.client.xReadGroup(
      REDIS_OUTBOX_GROUP,
      consumerName,
      [{ key: REDIS_OUTBOX_STREAM, id: '>' }],
      { COUNT: 10, BLOCK: 1_000 },
    );
    return parseStreams(streams);
  }

  async claimPending(consumerName: string): Promise<RedisOutboxMessage[]> {
    await this.ensureConnected();
    const result = await this.client.xAutoClaim(
      REDIS_OUTBOX_STREAM,
      REDIS_OUTBOX_GROUP,
      consumerName,
      REDIS_OUTBOX_PENDING_IDLE_MS,
      '0-0',
      { COUNT: 10 },
    );
    return parseStreamMessages(result.messages);
  }

  async acknowledge(streamId: string): Promise<void> {
    await this.ensureConnected();
    await this.client.xAck(REDIS_OUTBOX_STREAM, REDIS_OUTBOX_GROUP, streamId);
  }

  createConsumerName(): string {
    return `${process.env.HOSTNAME ?? 'worker'}-${process.pid}-${randomUUID()}`;
  }

  private enabled(): boolean {
    return (
      this.config.get('WORKER_ENABLED', { infer: true }) === true &&
      this.config.get('QUEUE_PROVIDER', { infer: true }) === 'redis'
    );
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isOpen) await this.connect();
  }

  private async connect(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }
}

function parseStreams(value: unknown): RedisOutboxMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((stream) => {
    if (!isRecord(stream)) return [];
    return parseStreamMessages(stream.messages);
  });
}

function parseStreamMessages(value: unknown): RedisOutboxMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!isRecord(message) || typeof message.id !== 'string') return [];
    const fields = message.message;
    if (!isRecord(fields)) return [];
    const eventId = fields.eventId;
    const claimToken = fields.claimToken;
    if (typeof eventId !== 'string' || typeof claimToken !== 'string')
      return [];
    return [{ streamId: message.id, eventId, claimToken }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

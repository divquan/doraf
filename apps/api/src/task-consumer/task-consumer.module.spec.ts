/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TaskConsumerModule } from './task-consumer.module';
import { OutboxTaskController } from '../operations/outbox-task.controller';
import { HealthController } from '../health/health.controller';
import { PricingController } from '../pricing/pricing.controller';
import { RefundsController } from '../refunds/refunds.controller';
import { WalletController } from '../wallet/wallet.controller';
import { RedisOutboxQueue } from '../operations/redis-outbox.queue';
import { GeneralOutboxWorker } from '../operations/general-outbox.worker';
import { PricingOutboxWorker } from '../pricing/pricing-outbox.worker';
import { RefundOutboxWorker } from '../refunds/refund-outbox.worker';
import { WithdrawalOutboxWorker } from '../wallet/withdrawal-outbox.worker';
import { DeliveryOutboxWorker } from '../delivery/delivery-outbox.worker';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';

describe('TaskConsumerModule runtime composition', () => {
  let app: INestApplication;

  const mockPrisma = {
    outboxEvent: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    refund: { findUnique: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((fn: any) => fn({ $queryRaw: jest.fn() })),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        CLOUD_TASKS_PROJECT_ID: 'test-project',
        CLOUD_TASKS_LOCATION: 'us-central1',
        CLOUD_TASKS_QUEUE: 'outbox',
        CLOUD_TASKS_TARGET_URL: 'http://localhost:3000/internal/tasks/outbox',
        CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
          'tasks@test-project.iam.gserviceaccount.com',
        CLOUD_TASKS_AUDIENCE: 'http://localhost:3000/internal/tasks/outbox',
        PORT: '3000',
        NODE_ENV: 'test',
      };
      return values[key] ?? 'test';
    }),
    getOrThrow: jest.fn((key: string) => 'test'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TaskConsumerModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(ConfigService)
      .useValue(mockConfig)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes only internal task and health routes', async () => {
    expect(() => app.get(OutboxTaskController)).not.toThrow();
    expect(() => app.get(HealthController)).not.toThrow();

    expect(() => app.get(PricingController)).toThrow();
    expect(() => app.get(RefundsController)).toThrow();
    expect(() => app.get(WalletController)).toThrow();

    const taskControllerMeta = Reflect.getMetadata(
      'path',
      OutboxTaskController,
    );
    expect(taskControllerMeta).toBe('internal/tasks/outbox');

    expect(() => app.get(RedisOutboxQueue)).toThrow();
    expect(() => app.get(GeneralOutboxWorker)).toThrow();
  });

  it('does not start continuous polling workers', async () => {
    expect(() => app.get(PricingOutboxWorker)).toThrow();
    expect(() => app.get(RefundOutboxWorker)).toThrow();
    expect(() => app.get(WithdrawalOutboxWorker)).toThrow();
    expect(() => app.get(DeliveryOutboxWorker)).toThrow();
  });

  it('health endpoints are available', async () => {
    const server = app.getHttpServer();
    await request(server).get('/health/live').expect(200);
  });

  it('route allowlist: only internal task and health are reachable', async () => {
    const server = app.getHttpServer();
    await request(server).post('/internal/tasks/outbox').send({}).expect(401);
    await request(server).get('/health/live').expect(200);
    await request(server).get('/health/ready').expect(200);
    await request(server).get('/v1/admin/products/pricing').expect(404);
    await request(server).get('/v1/admin/refunds').expect(404);
    await request(server).get('/v1/agent-wallet/summary').expect(404);
    await request(server)
      .post(
        '/v1/admin/products/00000000-0000-4000-a000-000000000000/pricing-policies',
      )
      .send({})
      .expect(404);
  });
});

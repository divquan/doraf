import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxService } from '../src/operations/outbox.service';
import { OutboxTaskRouter } from '../src/operations/outbox-task.router';
import { PricingOutboxHandler } from '../src/pricing/pricing-outbox.handler';
import { RefundOutboxHandler } from '../src/refunds/refund-outbox.handler';
import { WithdrawalOutboxHandler } from '../src/wallet/withdrawal-outbox.handler';
import { DeliveryOutboxHandler } from '../src/delivery/delivery-outbox.handler';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../src/config/environment';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

describeIfDb(
  'OutboxTaskRouter durable transitions (e2e with PostgreSQL)',
  () => {
    let moduleRef: TestingModule;
    let prisma: PrismaService;
    let router: OutboxTaskRouter;
    let nodeEnvironment = 'test';

    beforeAll(async () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'DATABASE_URL') return databaseUrl;
          if (key === 'NODE_ENV') return nodeEnvironment;
          if (key === 'CLOUD_TASKS_AUDIENCE')
            return 'http://localhost:3000/internal/tasks/outbox';
          if (key === 'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL')
            return 'tasks@test-project.iam.gserviceaccount.com';
          return 'test';
        }),
        getOrThrow: jest.fn(() => 'test'),
      } as unknown as ConfigService<AppEnvironment, true>;

      moduleRef = await Test.createTestingModule({
        providers: [
          {
            provide: PrismaService,
            useFactory: () => new PrismaService(config),
          },
          OutboxService,
          {
            provide: PricingOutboxHandler,
            useValue: { handleClaimed: jest.fn(() => Promise.resolve()) },
          },
          {
            provide: RefundOutboxHandler,
            useValue: { handleClaimed: jest.fn(() => Promise.resolve()) },
          },
          {
            provide: WithdrawalOutboxHandler,
            useValue: { handleClaimed: jest.fn(() => Promise.resolve()) },
          },
          {
            provide: DeliveryOutboxHandler,
            useValue: { handleClaimed: jest.fn(() => Promise.resolve()) },
          },
          OutboxTaskRouter,
        ],
      }).compile();

      prisma = moduleRef.get(PrismaService);
      router = moduleRef.get(OutboxTaskRouter);
    });

    afterAll(async () => moduleRef?.close());

    it('transitions informational event to DISPATCHED durably', async () => {
      const eventId = randomUUID();
      const claimToken = randomUUID();
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'PRODUCT_PRICING_POLICY_CREATED',
          aggregateType: 'PRODUCT_PRICING_POLICY',
          aggregateId: randomUUID(),
          aggregateVersion: 1,
          payload: {},
          state: 'CLAIMED',
          claimToken,
          claimedAt: new Date(),
          leaseUntil: new Date(Date.now() + 60_000),
          attemptCount: 1,
          availableAt: new Date(),
        },
      });

      await router.handle({ eventId, claimToken });

      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('DISPATCHED');
      expect(final.claimToken).toBeNull();
    });

    it('reschedules unknown event to FAILED terminally', async () => {
      const eventId = randomUUID();
      const claimToken = randomUUID();
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'UNKNOWN_FOOBAR',
          aggregateType: 'UNKNOWN',
          aggregateId: randomUUID(),
          aggregateVersion: 1,
          payload: {},
          state: 'CLAIMED',
          claimToken,
          claimedAt: new Date(),
          leaseUntil: new Date(Date.now() + 60_000),
          attemptCount: 1,
          availableAt: new Date(),
        },
      });

      await router.handle({ eventId, claimToken });

      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('FAILED');
      expect(final.lastError).toContain('No outbox handler');
    });

    it('treats already-dispatched event as stale without error', async () => {
      const eventId = randomUUID();
      const claimToken = randomUUID();
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'PRODUCT_PRICING_POLICY_CREATED',
          aggregateType: 'PRODUCT_PRICING_POLICY',
          aggregateId: randomUUID(),
          aggregateVersion: 1,
          payload: {},
          state: 'DISPATCHED',
          dispatchedAt: new Date(),
          attemptCount: 1,
          availableAt: new Date(),
        },
      });

      // Try to handle with stale claimToken – should be treated as success (no throw)
      await expect(
        router.handle({ eventId, claimToken }),
      ).resolves.toBeUndefined();
      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('DISPATCHED');
    });

    it('handles QUEUED state same as CLAIMED (publisher crash before markQueued)', async () => {
      const eventId = randomUUID();
      const claimToken = randomUUID();
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'PRODUCT_PRICING_POLICY_CREATED',
          aggregateType: 'PRODUCT_PRICING_POLICY',
          aggregateId: randomUUID(),
          aggregateVersion: 1,
          payload: {},
          state: 'QUEUED',
          claimToken,
          claimedAt: new Date(),
          leaseUntil: new Date(Date.now() + 60_000),
          attemptCount: 1,
          availableAt: new Date(),
        },
      });

      await router.handle({ eventId, claimToken });
      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('DISPATCHED');
    });

    it('reschedules delivery in production to FAILED', async () => {
      const eventId = randomUUID();
      const claimToken = randomUUID();
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'DELIVERY_MESSAGE_REQUESTED',
          aggregateType: 'DELIVERY_MESSAGE',
          aggregateId: randomUUID(),
          aggregateVersion: 1,
          payload: {},
          state: 'CLAIMED',
          claimToken,
          claimedAt: new Date(),
          leaseUntil: new Date(Date.now() + 60_000),
          attemptCount: 1,
          availableAt: new Date(),
        },
      });

      nodeEnvironment = 'production';

      await router.handle({ eventId, claimToken });

      nodeEnvironment = 'test';

      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('FAILED');
    });
  },
);

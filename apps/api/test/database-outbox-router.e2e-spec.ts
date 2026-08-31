/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { randomUUID, randomBytes } from 'node:crypto';
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
import { PaymentGatewayService } from '../src/payments/payment-gateway.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

describeIfDb(
  'OutboxTaskRouter durable transitions (e2e with PostgreSQL)',
  () => {
    let moduleRef: TestingModule;
    let prisma: PrismaService;
    let router: OutboxTaskRouter;
    let outbox: OutboxService;

    beforeAll(async () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'DATABASE_URL') return databaseUrl;
          if (key === 'NODE_ENV') return 'test';
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
            useValue: { handleClaimed: jest.fn(async () => {}) },
          },
          {
            provide: RefundOutboxHandler,
            useValue: { handleClaimed: jest.fn(async () => {}) },
          },
          {
            provide: WithdrawalOutboxHandler,
            useValue: { handleClaimed: jest.fn(async () => {}) },
          },
          {
            provide: DeliveryOutboxHandler,
            useValue: { handleClaimed: jest.fn(async () => {}) },
          },
          OutboxTaskRouter,
        ],
      }).compile();

      prisma = moduleRef.get(PrismaService);
      outbox = moduleRef.get(OutboxService);
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

      // Temporarily set NODE_ENV to production for this test
      const originalGet = (router as any).config.get;
      (router as any).config.get = jest.fn((key: string) =>
        key === 'NODE_ENV' ? 'production' : 'test',
      );

      await router.handle({ eventId, claimToken });

      // Restore
      (router as any).config.get = originalGet;

      const final = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(final.state).toBe('FAILED');
    });
  },
);

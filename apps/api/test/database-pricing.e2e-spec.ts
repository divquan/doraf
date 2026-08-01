import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import type { InternalPrincipal } from '../src/internal-access/internal-access.types';
import { IdempotencyService } from '../src/operations/idempotency.service';
import { OutboxService } from '../src/operations/outbox.service';
import { PricingService } from '../src/pricing/pricing.service';
import { PricingOutboxHandler } from '../src/pricing/pricing-outbox.handler';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for pricing database tests');

describe('pricing transactions', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let pricing: PricingService;
  let handler: PricingOutboxHandler;
  let outbox: OutboxService;
  let productId: string;
  let agentId: string;
  let actor: InternalPrincipal;

  beforeAll(async () => {
    const config = {
      get: jest.fn().mockReturnValue(databaseUrl),
    } as unknown as ConfigService<AppEnvironment, true>;
    module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        IdempotencyService,
        OutboxService,
        PricingService,
        PricingOutboxHandler,
      ],
    }).compile();
    prisma = module.get(PrismaService);
    pricing = module.get(PricingService);
    handler = module.get(PricingOutboxHandler);
    outbox = module.get(OutboxService);

    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Pricing Database Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '024****321',
        encryptionKeyId: 'test-key-v1',
      },
    });
    agentId = agent.id;
    const product = await prisma.product.create({
      data: {
        code: `PRICE_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        name: 'Pricing Database Product',
        scopeDisclosure: 'Integration-test product.',
        displayOrder: 98,
      },
    });
    productId = product.id;
    const administrator = await prisma.internalUser.create({
      data: {
        displayName: 'Pricing Database Administrator',
        role: 'ADMINISTRATOR',
      },
    });
    actor = {
      userId: administrator.id,
      sessionId: randomUUID(),
      displayName: administrator.displayName,
      role: administrator.role,
      authenticationStrength: 'PHISHING_RESISTANT',
      authenticatedAt: new Date(),
      stepUpAt: new Date(),
    };
  });

  afterAll(async () => module.close());

  it('replays duplicate commands and atomically clamps active prices', async () => {
    const initialKey = randomUUID();
    const initial = await pricing.createDefaultPolicy({
      productId,
      basePriceMinor: 2_000,
      maximumRetailPriceMinor: 3_000,
      effectiveFrom: new Date(Date.now() - 60_000),
      reason: 'Initial integration pricing policy',
      requestId: randomUUID(),
      actor,
      idempotencyKey: initialKey,
    });
    const replay = await pricing.createDefaultPolicy({
      productId,
      basePriceMinor: 2_000,
      maximumRetailPriceMinor: 3_000,
      effectiveFrom: new Date(initial.policy.effectiveFrom),
      reason: 'Initial integration pricing policy',
      requestId: randomUUID(),
      actor,
      idempotencyKey: initialKey,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.policy.id).toBe(initial.policy.id);

    await pricing.setRetailPrice({
      agentId,
      productId,
      retailPriceMinor: 2_100,
      idempotencyKey: randomUUID(),
    });
    const changed = await pricing.createDefaultPolicy({
      productId,
      basePriceMinor: 2_400,
      maximumRetailPriceMinor: 3_200,
      effectiveFrom: new Date(),
      reason: 'Raise base and clamp active prices',
      requestId: randomUUID(),
      actor,
      idempotencyKey: randomUUID(),
    });
    expect(changed.clampedPriceCount).toBe(1);
    await expect(
      prisma.agentProductPrice.findUniqueOrThrow({
        where: { agentId_productId: { agentId, productId } },
        select: { retailPriceMinor: true, version: true },
      }),
    ).resolves.toEqual({ retailPriceMinor: 2_400n, version: 2 });
    await expect(
      prisma.auditEvent.count({
        where: {
          entityType: 'AGENT_PRODUCT_PRICE',
          action: 'AGENT_RETAIL_PRICE_CLAMPED',
        },
      }),
    ).resolves.toBeGreaterThanOrEqual(1);
  });

  it('schedules future policy activation and rolls back conflicting retries', async () => {
    const future = new Date(Date.now() + 3_600_000);
    const key = randomUUID();
    const created = await pricing.createDefaultPolicy({
      productId,
      basePriceMinor: 2_500,
      maximumRetailPriceMinor: 3_300,
      effectiveFrom: future,
      reason: 'Future integration pricing policy',
      requestId: randomUUID(),
      actor,
      idempotencyKey: key,
    });
    const due = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: created.policy.id,
        eventType: 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
      },
    });
    expect(due.availableAt.getTime()).toBe(future.getTime());

    const activationTime = new Date();
    await prisma.productPricingPolicy.updateMany({
      where: { productId, id: { not: created.policy.id }, effectiveTo: future },
      data: { effectiveTo: activationTime },
    });
    await prisma.productPricingPolicy.update({
      where: { id: created.policy.id },
      data: { effectiveFrom: activationTime },
    });
    await prisma.outboxEvent.update({
      where: { id: due.id },
      data: { availableAt: activationTime },
    });
    const claimToken = randomUUID();
    const claimed = (await outbox.claimAvailableForEventTypes(50, claimToken, [
      'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
    ])) as Array<{ id: string }>;
    const activation = claimed.find((event) => event.id === due.id);
    expect(activation).toBeDefined();
    await expect(
      handler.handleClaimed(activation!.id, claimToken),
    ).resolves.toBe(true);
    await expect(
      prisma.agentProductPrice.findUniqueOrThrow({
        where: { agentId_productId: { agentId, productId } },
        select: { retailPriceMinor: true, version: true },
      }),
    ).resolves.toEqual({ retailPriceMinor: 2_500n, version: 3 });

    await expect(
      pricing.createDefaultPolicy({
        productId,
        basePriceMinor: 2_600,
        maximumRetailPriceMinor: 3_300,
        effectiveFrom: future,
        reason: 'Different request with reused key',
        requestId: randomUUID(),
        actor,
        idempotencyKey: key,
      }),
    ).rejects.toThrow('different request');
    await expect(
      prisma.productPricingPolicy.count({
        where: { id: created.policy.id },
      }),
    ).resolves.toBe(1);
  });

  it('creates an agent override with a fully scoped idempotency identity', async () => {
    const product = await prisma.product.create({
      data: {
        code: `OVR_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        name: 'Agent Override Database Product',
        scopeDisclosure: 'Integration-test override product.',
        displayOrder: 97,
      },
    });
    await pricing.createDefaultPolicy({
      productId: product.id,
      basePriceMinor: 2_000,
      maximumRetailPriceMinor: 3_000,
      effectiveFrom: new Date(Date.now() - 60_000),
      reason: 'Default policy for agent override regression coverage',
      requestId: randomUUID(),
      actor,
      idempotencyKey: randomUUID(),
    });

    await expect(
      pricing.createOverride({
        productId: product.id,
        agentId,
        basePriceMinor: 2_100,
        maximumRetailPriceMinor: 2_900,
        effectiveFrom: new Date(),
        reason: 'Agent override regression coverage',
        requestId: randomUUID(),
        actor,
        idempotencyKey: randomUUID(),
      }),
    ).resolves.toMatchObject({ replayed: false });

    await expect(
      pricing.changeProductStatus({
        productId: product.id,
        status: 'ACTIVE',
        reason: 'Publish product after pricing and inventory review',
        requestId: randomUUID(),
        actor,
      }),
    ).resolves.toMatchObject({ id: product.id, status: 'ACTIVE' });
    await expect(
      prisma.auditEvent.findFirstOrThrow({
        where: {
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'PRODUCT_MADE_AVAILABLE',
        },
      }),
    ).resolves.toBeDefined();
  });
});

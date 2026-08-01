import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { IdempotencyService } from '../src/operations/idempotency.service';
import { OutboxService } from '../src/operations/outbox.service';
import { OrderContactProtectionService } from '../src/orders/order-contact-protection.service';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentGatewayService } from '../src/payments/payment-gateway.service';
import { PaymentProcessingService } from '../src/payments/payment-processing.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for order database tests');

describe('order creation and inventory reservation', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentProcessingService;

  beforeAll(async () => {
    const values: Partial<AppEnvironment> = {
      DATABASE_URL: databaseUrl,
      ORDER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 31).toString(
        'base64',
      ),
      ORDER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 32).toString(
        'base64',
      ),
      PAYSTACK_GUEST_EMAIL_DOMAIN: 'guest.localhost',
      PAYSTACK_MODE: 'local',
      PAYSTACK_SECRET_KEY: null,
      NODE_ENV: 'test',
    };
    const config = {
      get: jest.fn((key: keyof AppEnvironment) => values[key]),
      getOrThrow: jest.fn((key: keyof AppEnvironment) => {
        const value = values[key];
        if (value === undefined) throw new Error(`${key} not configured`);
        return value;
      }),
    } as unknown as ConfigService<AppEnvironment, true>;
    module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        { provide: ConfigService, useValue: config },
        IdempotencyService,
        OutboxService,
        OrderContactProtectionService,
        OrdersService,
        PaymentGatewayService,
        PaymentProcessingService,
      ],
    }).compile();
    prisma = module.get(PrismaService);
    orders = module.get(OrdersService);
    payments = module.get(PaymentProcessingService);
  });

  afterAll(async () => module.close());

  it('atomically snapshots an order and reserves the complete quantity', async () => {
    const fixture = await createCheckoutFixture(prisma, 2);
    const idempotencyKey = randomUUID();
    const command = checkoutCommand(fixture, idempotencyKey, 2);

    const created = await orders.createWebOrder(command);
    const replay = await orders.createWebOrder(command);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicReference: created.orderReference },
      include: {
        items: true,
        reservations: { include: { items: true } },
        paymentAttempts: true,
      },
    });

    expect(replay.orderReference).toBe(created.orderReference);
    expect(replay.replayed).toBe(true);
    expect(order.items).toHaveLength(2);
    expect(order.reservations[0]?.items).toHaveLength(2);
    expect(order.paymentAttempts).toHaveLength(1);
    expect(order.paymentAttempts[0]?.providerReference).toMatch(
      /^[A-Za-z0-9.=-]+$/,
    );
    await expect(
      prisma.voucher.count({
        where: { id: { in: fixture.voucherIds }, availability: 'RESERVED' },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.inventoryEvent.count({
        where: {
          sourceType: 'PAYMENT_ATTEMPT',
          sourceId: order.paymentAttempts[0]?.id,
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.outboxEvent.count({
        where: {
          aggregateType: 'PAYMENT_ATTEMPT',
          aggregateId: order.paymentAttempts[0]?.id,
          eventType: 'PAYMENT_INITIALIZATION_REQUESTED',
        },
      }),
    ).resolves.toBe(1);

    const response = JSON.stringify(created);
    expect(response).not.toContain('0241234567');
    expect(response).not.toContain('buyer@example.com');
    expect(response).not.toContain('0247654321');
  });

  it('never partially allocates or duplicates the final available voucher', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const attempts = await Promise.allSettled([
      orders.createWebOrder(checkoutCommand(fixture, randomUUID(), 1)),
      orders.createWebOrder(checkoutCommand(fixture, randomUUID(), 1)),
    ]);
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = attempts.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    await expect(
      prisma.inventoryReservationItem.count({
        where: { voucherId: fixture.voucherIds[0] },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.order.count({
        where: { productId: fixture.productId },
      }),
    ).resolves.toBe(1);
  });

  it('releases an expired uninitialized reservation before reallocating stock', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const first = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    const firstOrder = await prisma.order.findUniqueOrThrow({
      where: { publicReference: first.orderReference },
      include: { reservations: true, paymentAttempts: true },
    });
    const expiredAt = new Date(Date.now() - 5 * 60_000);
    await prisma.inventoryReservation.update({
      where: { id: firstOrder.reservations[0]?.id },
      data: {
        createdAt: new Date(Date.now() - 10 * 60_000),
        expiresAt: expiredAt,
      },
    });

    const second = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    expect(second.orderReference).not.toBe(first.orderReference);
    await expect(
      prisma.inventoryReservation.findUniqueOrThrow({
        where: { id: firstOrder.reservations[0]?.id },
        select: { state: true },
      }),
    ).resolves.toEqual({ state: 'RELEASED' });
    await expect(
      prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: firstOrder.paymentAttempts[0]?.id },
        select: { state: true },
      }),
    ).resolves.toEqual({ state: 'ABANDONED' });
  });

  it('applies a successful payment exactly once across commercial effects', async () => {
    const fixture = await createCheckoutFixture(prisma, 2);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 2),
    );
    const initialized = await payments.initializePayment(
      created.payment.reference,
    );
    expect(initialized).toMatchObject({
      state: 'PENDING_AUTHORIZATION',
      providerStatus: 'pay_offline',
      localDevelopment: true,
    });

    await payments.completeLocalPayment(
      fixture.webSalesId,
      created.orderReference,
    );
    await payments.completeLocalPayment(
      fixture.webSalesId,
      created.orderReference,
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { publicReference: created.orderReference },
      include: {
        paymentAttempts: true,
        reservations: true,
        items: { include: { allocation: true } },
        ledgerEntries: true,
        deliveryMessages: true,
      },
    });
    expect(order).toMatchObject({
      paymentState: 'PAID',
      fulfillmentState: 'COMPLETE',
    });
    expect(order.paymentAttempts).toHaveLength(1);
    expect(order.paymentAttempts[0]).toMatchObject({
      state: 'SUCCESS',
      classification: 'ACCEPTED',
    });
    expect(order.reservations).toHaveLength(1);
    expect(order.reservations[0]?.state).toBe('CONSUMED');
    expect(order.items.every((item) => item.allocation !== null)).toBe(true);
    expect(order.ledgerEntries).toHaveLength(1);
    expect(order.ledgerEntries[0]).toMatchObject({
      type: 'SALE_CREDIT',
      amountMinor: 1_000n,
    });
    expect(order.deliveryMessages).toHaveLength(3);
    expect(
      order.deliveryMessages.filter((message) => message.channel === 'SMS'),
    ).toHaveLength(2);
    await expect(
      prisma.voucher.count({
        where: { id: { in: fixture.voucherIds }, availability: 'SOLD' },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.outboxEvent.count({
        where: {
          aggregateType: 'DELIVERY_MESSAGE',
          eventType: 'DELIVERY_MESSAGE_REQUESTED',
          aggregateId: {
            in: order.deliveryMessages.map((message) => message.id),
          },
        },
      }),
    ).resolves.toBe(3);
  });
});

async function createCheckoutFixture(prisma: PrismaService, stock: number) {
  const tenant = await prisma.agentTenant.create({ data: {} });
  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      name: 'Checkout Test Agent',
      phoneCiphertext: Uint8Array.from(randomBytes(48)),
      phoneFingerprint: Uint8Array.from(randomBytes(32)),
      phoneMask: '+233 •• ••• 4567',
      encryptionKeyId: 'test-key-v1',
    },
  });
  const product = await prisma.product.create({
    data: {
      code: `ORDER_${randomUUID().replaceAll('-', '').toUpperCase()}`,
      name: 'Checkout Test Checker',
      scopeDisclosure: 'Order reservation integration-test product.',
      displayOrder: 96,
      status: 'ACTIVE',
    },
  });
  await prisma.productPricingPolicy.create({
    data: {
      productId: product.id,
      basePriceMinor: 1_500,
      maximumRetailPriceMinor: 2_500,
      effectiveFrom: new Date(Date.now() - 60_000),
      reason: 'Checkout integration-test price',
    },
  });
  await prisma.agentProductPrice.create({
    data: {
      agentId: agent.id,
      productId: product.id,
      retailPriceMinor: 2_000,
    },
  });
  const uploader = await prisma.internalUser.create({
    data: {
      displayName: 'Checkout Test Inventory Operator',
      role: 'ADMINISTRATOR',
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      productId: product.id,
      vendorName: 'Checkout Test Vendor',
      vendorReference: randomUUID(),
      acquisitionDate: new Date('2026-08-01T00:00:00Z'),
      unitAcquisitionCostMinor: 1_000,
      sourceRowCount: stock,
      acceptedRowCount: stock,
      encryptedDataKey: Uint8Array.from(randomBytes(48)),
      kmsKeyVersion: 'test-master-key:v1',
      uploadedByActorId: uploader.id,
    },
  });
  const voucherIds = Array.from({ length: stock }, () => randomUUID());
  await prisma.voucher.createMany({
    data: voucherIds.map((id, index) => ({
      id,
      batchId: batch.id,
      productId: product.id,
      serialCiphertext: Uint8Array.from(randomBytes(32)),
      serialNonce: Uint8Array.from(randomBytes(12)),
      serialAuthTag: Uint8Array.from(randomBytes(16)),
      serialFingerprint: Uint8Array.from(randomBytes(32)),
      serialMask: `SERIAL••${index}`,
      serialKeyVersion: 'test-master-key:v1',
      pinCiphertext: Uint8Array.from(randomBytes(32)),
      pinNonce: Uint8Array.from(randomBytes(12)),
      pinAuthTag: Uint8Array.from(randomBytes(16)),
      pinFingerprint: Uint8Array.from(randomBytes(32)),
      pinMask: `••••••••••${String(index).padStart(2, '0')}`,
      pinKeyVersion: 'test-master-key:v1',
    })),
  });
  return {
    webSalesId: agent.webSalesId,
    productId: product.id,
    voucherIds,
  };
}

function checkoutCommand(
  fixture: { webSalesId: string; productId: string },
  idempotencyKey: string,
  quantity: number,
) {
  return {
    webSalesId: fixture.webSalesId,
    productId: fixture.productId,
    quantity,
    deliveryPhone: '0241234567',
    deliveryPhoneConfirmation: '0241234567',
    deliveryEmail: 'buyer@example.com',
    deliveryEmailConfirmation: 'buyer@example.com',
    payerPhone: '0247654321',
    payerNetwork: 'MTN',
    idempotencyKey,
  };
}

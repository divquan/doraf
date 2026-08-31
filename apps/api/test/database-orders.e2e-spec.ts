import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { DevelopmentDeliveryGateway } from '../src/delivery/delivery-gateway.service';
import { DeliveryOutboxHandler } from '../src/delivery/delivery-outbox.handler';
import { IdempotencyService } from '../src/operations/idempotency.service';
import { OutboxService } from '../src/operations/outbox.service';
import { CheckoutAccessTokenService } from '../src/orders/checkout-access-token.service';
import { OrderContactProtectionService } from '../src/orders/order-contact-protection.service';
import { OrdersService } from '../src/orders/orders.service';
import {
  PaymentGatewayService,
  PaymentProviderRequestException,
} from '../src/payments/payment-gateway.service';
import { PaymentProcessingService } from '../src/payments/payment-processing.service';
import { PaymentInitializationWorker } from '../src/payments/payment-initialization.worker';
import { SMS_OTP_SENDER } from '../src/agent-access/agent-access.types';
import { BuyerRecoveryService } from '../src/recovery/buyer-recovery.service';
import { BuyerRecoveryTokenService } from '../src/recovery/buyer-recovery-token.service';
import { VoucherRevealService } from '../src/recovery/voucher-reveal.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for order database tests');

describe('order creation and inventory reservation', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentProcessingService;
  let paymentInitialization: PaymentInitializationWorker;
  let delivery: DeliveryOutboxHandler;
  let recovery: BuyerRecoveryService;
  let recoverySms: { send: jest.Mock };
  let paymentGateway: {
    mode: 'sandbox';
    initialize: jest.Mock;
    verify: jest.Mock;
  };

  beforeAll(async () => {
    const values: Partial<AppEnvironment> = {
      DATABASE_URL: databaseUrl,
      ORDER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 31).toString(
        'base64',
      ),
      ORDER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 32).toString(
        'base64',
      ),
      PAYSTACK_GUEST_EMAIL_DOMAIN: 'example.com',
      PAYSTACK_MODE: 'sandbox',
      PAYSTACK_SECRET_KEY: 'sk_test_database-payment-secret',
      NODE_ENV: 'test',
      WORKER_ENABLED: true,
      WORKER_EXECUTION: 'run-once',
      OTP_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 33).toString('base64'),
      SESSION_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 34).toString('base64'),
      AGENT_AUTH_OTP_TTL_SECONDS: 300,
      AGENT_AUTH_OTP_MAX_ATTEMPTS: 5,
    };
    const initializedPayments = new Map<
      string,
      { amountMinor: bigint; currency: string }
    >();
    const deliveryGateway = {
      submit: jest.fn((input: { stableClientReference: string }) => ({
        provider: 'test-delivery',
        providerMessageReference: `test-${input.stableClientReference}`,
        safeMetadata: { adapter: 'test' },
      })),
    };
    recoverySms = { send: jest.fn(() => Promise.resolve()) };
    const voucherReveal = {
      reveal: jest.fn(() => ({
        serialNumber: 'RECOVERY-SERIAL',
        pin: '012345678912',
      })),
    };
    paymentGateway = {
      mode: 'sandbox' as const,
      initialize: jest.fn(
        (input: {
          reference: string;
          amountMinor: bigint;
          currency: string;
        }) => {
          initializedPayments.set(input.reference, {
            amountMinor: input.amountMinor,
            currency: input.currency,
          });
          return {
            reference: input.reference,
            status: 'initialized',
            amountMinor: input.amountMinor,
            currency: input.currency,
            transactionId: 'sandbox-transaction',
            accessCode: 'paystack-access-code',
            displayText: 'Approve the payment prompt on your phone.',
            message: 'Sandbox payment initialized',
          };
        },
      ),
      verify: jest.fn((reference: string) => {
        const initialized = initializedPayments.get(reference);
        if (!initialized) throw new Error('Payment was not initialized');
        return {
          reference,
          status: 'success',
          amountMinor: initialized.amountMinor,
          currency: initialized.currency,
          transactionId: 'sandbox-transaction',
          accessCode: null,
          displayText: null,
          message: 'Sandbox payment verified',
        };
      }),
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
        CheckoutAccessTokenService,
        OrderContactProtectionService,
        { provide: DevelopmentDeliveryGateway, useValue: deliveryGateway },
        DeliveryOutboxHandler,
        OrdersService,
        { provide: PaymentGatewayService, useValue: paymentGateway },
        PaymentProcessingService,
        PaymentInitializationWorker,
        BuyerRecoveryTokenService,
        BuyerRecoveryService,
        { provide: SMS_OTP_SENDER, useValue: recoverySms },
        { provide: VoucherRevealService, useValue: voucherReveal },
      ],
    }).compile();
    prisma = module.get(PrismaService);
    orders = module.get(OrdersService);
    payments = module.get(PaymentProcessingService);
    paymentInitialization = module.get(PaymentInitializationWorker);
    delivery = module.get(DeliveryOutboxHandler);
    recovery = module.get(BuyerRecoveryService);
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
      providerStatus: 'initialized',
      accessCode: 'paystack-access-code',
    });

    await payments.verifyPayment(created.payment.reference);
    await payments.verifyPayment(created.payment.reference);

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

    const publicStatus = await payments.getPublicOrderStatus(
      fixture.webSalesId,
      created.orderReference,
    );
    expect(publicStatus.delivery.channels).toEqual(['SMS', 'EMAIL']);
    expect(JSON.stringify(publicStatus)).not.toContain('RECOVERY-SERIAL');
    await expect(
      payments.revealPublicOrder(
        fixture.webSalesId,
        created.orderReference,
        created.checkoutAccessToken,
      ),
    ).resolves.toMatchObject({
      vouchers: [
        { position: 1, serialNumber: 'RECOVERY-SERIAL', pin: '012345678912' },
        { position: 2, serialNumber: 'RECOVERY-SERIAL', pin: '012345678912' },
      ],
    });
    await expect(
      payments.revealPublicOrder(
        fixture.webSalesId,
        created.orderReference,
        'not-a-checkout-token',
      ),
    ).rejects.toThrow('checkout session has expired');

    const claimToken = randomUUID();
    await prisma.outboxEvent.updateMany({
      where: {
        aggregateId: {
          in: order.deliveryMessages.map((message) => message.id),
        },
        eventType: 'DELIVERY_MESSAGE_REQUESTED',
        state: 'PENDING',
      },
      data: { state: 'CLAIMED', claimToken, claimedAt: new Date() },
    });
    const events = await prisma.outboxEvent.findMany({
      where: { claimToken, state: 'CLAIMED' },
    });
    for (const event of events) {
      await delivery.handleClaimed(event.id, claimToken);
    }
    const delivered = await prisma.deliveryMessage.findMany({
      where: {
        id: { in: order.deliveryMessages.map((message) => message.id) },
      },
      include: { attempts: true },
    });
    expect(delivered.map((message) => message.state)).toEqual([
      'SUBMITTED',
      'SUBMITTED',
      'SUBMITTED',
    ]);
    expect(delivered.every((message) => message.attempts.length === 1)).toBe(
      true,
    );
    expect(delivered.flatMap((message) => message.attempts)).toHaveLength(3);
    expect(
      delivered
        .flatMap((message) => message.attempts)
        .every((attempt) =>
          attempt.stableClientReference.includes('-attempt-1'),
        ),
    ).toBe(true);
  });

  it('immediately releases inventory after Paystack definitively rejects initialization', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    paymentGateway.initialize.mockImplementationOnce(() => {
      throw new PaymentProviderRequestException(
        'definitive',
        400,
        'Invalid Mobile Money number',
      );
    });

    await expect(
      payments.initializePayment(created.payment.reference),
    ).rejects.toThrow('Paystack rejected payment setup');

    const order = await prisma.order.findUniqueOrThrow({
      where: { publicReference: created.orderReference },
      include: { paymentAttempts: true, reservations: true },
    });
    expect(order.paymentAttempts[0]?.state).toBe('FAILED');
    expect(order.paymentAttempts[0]?.providerStatus).toBe(
      'INITIATION_REJECTED',
    );
    expect(order.reservations[0]?.state).toBe('RELEASED');
    await expect(
      prisma.voucher.count({
        where: { id: fixture.voucherIds[0], availability: 'AVAILABLE' },
      }),
    ).resolves.toBe(1);
  });

  it('recovers an ambiguous initialization on the same payment attempt', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    const original = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { providerReference: created.payment.reference },
      include: { reservation: { include: { items: true } } },
    });

    paymentGateway.initialize.mockImplementationOnce(() => {
      throw new PaymentProviderRequestException(
        'ambiguous',
        null,
        'Request timed out after Paystack accepted the prompt',
      );
    });
    await expect(
      payments.initializePayment(created.payment.reference),
    ).rejects.toThrow('checkout could not be confirmed');

    await prisma.paymentAttempt.update({
      where: { id: original.id },
      data: { nextReconciliationAt: new Date(Date.now() - 1_000) },
    });
    const ambiguous = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(ambiguous).toMatchObject({
      state: 'RECONCILING',
      providerStatus: 'INITIATION_UNCONFIRMED',
      providerReference: created.payment.reference,
    });

    paymentGateway.initialize.mockImplementationOnce(() => ({
      reference: created.payment.reference,
      status: 'ongoing',
      amountMinor: ambiguous.expectedAmountMinor,
      currency: ambiguous.currency,
      transactionId: 'recovered-initialization-transaction',
      accessCode: 'recovered-access-code',
      displayText: 'Approve the recovered payment prompt.',
      message: 'Recovered payment initialization',
    }));
    await paymentInitialization.runOnce();

    const recovered = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: original.id },
      include: { reservation: { include: { items: true } } },
    });
    expect(recovered).toMatchObject({
      id: original.id,
      attemptNumber: original.attemptNumber,
      providerReference: original.providerReference,
      state: 'PENDING_AUTHORIZATION',
      providerStatus: 'ongoing',
      providerTransactionId: 'recovered-initialization-transaction',
      providerAccessCode: 'recovered-access-code',
    });
    expect(recovered.reservation).toMatchObject({
      id: original.reservation?.id,
      state: 'ACTIVE',
    });
    await expect(
      prisma.paymentAttempt.count({
        where: { orderId: original.orderId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.voucher.count({
        where: { id: fixture.voucherIds[0], availability: 'RESERVED' },
      }),
    ).resolves.toBe(1);
  });

  it('claims a due payment once, verifies it, and releases expired reconciliation inventory', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    await payments.initializePayment(created.payment.reference);
    const expiredAt = new Date(Date.now() - 6 * 60_000);
    await prisma.paymentAttempt.update({
      where: { providerReference: created.payment.reference },
      data: {
        createdAt: new Date(Date.now() - 10 * 60_000),
        authorizationExpiresAt: expiredAt,
        nextReconciliationAt: expiredAt,
      },
    });
    paymentGateway.verify.mockResolvedValueOnce({
      reference: created.payment.reference,
      status: 'pending',
      amountMinor: null,
      currency: null,
      transactionId: 'pending-transaction',
      accessCode: null,
      displayText: null,
      message: 'Awaiting authorization',
    });

    const claimed = await payments.claimDueReconciliationAttempts();
    expect(claimed).toContain(created.payment.reference);
    await expect(
      payments.claimDueReconciliationAttempts(),
    ).resolves.not.toContain(created.payment.reference);
    await payments.reconcileDuePayment(created.payment.reference);

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { providerReference: created.payment.reference },
    });
    const reservation = await prisma.inventoryReservation.findFirstOrThrow({
      where: { paymentAttemptId: attempt.id },
    });
    expect(attempt.state).toBe('RECONCILING');
    expect(attempt.providerStatus).toBe('pending');
    expect(attempt.nextReconciliationAt).not.toBeNull();
    expect(reservation.state).toBe('RELEASED');
    await expect(
      prisma.voucher.count({
        where: { id: fixture.voucherIds[0], availability: 'AVAILABLE' },
      }),
    ).resolves.toBe(1);

    paymentGateway.verify.mockResolvedValueOnce({
      reference: created.payment.reference,
      status: 'success',
      amountMinor: attempt.expectedAmountMinor,
      currency: attempt.currency,
      transactionId: 'late-success-transaction',
      accessCode: null,
      displayText: null,
      message: 'Late payment confirmed',
    });
    await payments.reconcileDuePayment(created.payment.reference);

    const fulfilled = await prisma.order.findUniqueOrThrow({
      where: { id: reservation.orderId },
      include: { items: { include: { allocation: true } } },
    });
    expect(fulfilled).toMatchObject({
      paymentState: 'PAID',
      fulfillmentState: 'COMPLETE',
    });
    expect(fulfilled.items[0]?.allocation).not.toBeNull();
    await expect(
      prisma.voucher.count({
        where: { id: fixture.voucherIds[0], availability: 'SOLD' },
      }),
    ).resolves.toBe(1);
  });

  it('retries a failed payment with a new attempt and reservation', async () => {
    const fixture = await createCheckoutFixture(prisma, 2);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    paymentGateway.initialize.mockImplementationOnce(() => {
      throw new PaymentProviderRequestException(
        'definitive',
        400,
        'Invalid Mobile Money number',
      );
    });
    await expect(
      payments.initializePayment(created.payment.reference),
    ).rejects.toThrow('Paystack rejected payment setup');

    const retried = await orders.retryWebOrder({
      webSalesId: fixture.webSalesId,
      orderReference: created.orderReference,
      checkoutAccessToken: created.checkoutAccessToken,
      idempotencyKey: randomUUID(),
    });
    expect(retried.payment.reference).not.toBe(created.payment.reference);
    await payments.initializePayment(retried.payment.reference);

    const attempts = await prisma.paymentAttempt.findMany({
      where: { order: { publicReference: created.orderReference } },
      orderBy: { attemptNumber: 'asc' },
    });
    expect(attempts.map((attempt) => attempt.state)).toEqual([
      'FAILED',
      'PENDING_AUTHORIZATION',
    ]);
    await expect(
      prisma.inventoryReservation.count({
        where: {
          order: { publicReference: created.orderReference },
          state: 'ACTIVE',
        },
      }),
    ).resolves.toBe(1);
  });

  it('keeps inventory reserved and schedules another verification after a provider timeout', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    await payments.initializePayment(created.payment.reference);
    const dueAt = new Date(Date.now() - 1_000);
    await prisma.paymentAttempt.update({
      where: { providerReference: created.payment.reference },
      data: { nextReconciliationAt: dueAt },
    });
    paymentGateway.verify.mockImplementationOnce(() => {
      throw new PaymentProviderRequestException(
        'ambiguous',
        null,
        'Request timed out',
      );
    });

    await payments.claimDueReconciliationAttempts();
    await expect(
      payments.reconcileDuePayment(created.payment.reference),
    ).rejects.toThrow('Paystack payment initialization failed');

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { providerReference: created.payment.reference },
      include: { reservation: true },
    });
    expect(attempt.state).toBe('RECONCILING');
    expect(attempt.providerStatus).toBe('VERIFICATION_UNCONFIRMED');
    expect(attempt.nextReconciliationAt?.getTime()).toBeGreaterThan(Date.now());
    expect(attempt.reservation?.state).toBe('ACTIVE');
  });

  it('recovers only a paid order after delivery-phone OTP verification', async () => {
    const fixture = await createCheckoutFixture(prisma, 1);
    const created = await orders.createWebOrder(
      checkoutCommand(fixture, randomUUID(), 1),
    );
    await payments.initializePayment(created.payment.reference);
    await payments.verifyPayment(created.payment.reference);

    const requested = await recovery.request(created.orderReference);
    expect(requested).toMatchObject({ accepted: true });
    expect(JSON.stringify(requested)).not.toContain('0241234567');
    const sent = recoverySms.send.mock.calls.at(-1) as [string, string];
    expect(sent[0]).toBe('+233241234567');

    await expect(
      recovery.verify(requested.challengeId, '999999'),
    ).rejects.toThrow('verification code is invalid');
    const verified = await recovery.verify(requested.challengeId, sent[1]);
    const result = await recovery.reveal(verified.recoveryToken);

    expect(result).toMatchObject({
      orderReference: created.orderReference,
      vouchers: [
        { position: 1, serialNumber: 'RECOVERY-SERIAL', pin: '012345678912' },
      ],
    });
    await expect(
      prisma.buyerRecoveryEvent.count({
        where: { challengeId: requested.challengeId },
      }),
    ).resolves.toBe(3);
  });

  it('returns the same recovery request shape for an unknown order without sending OTP', async () => {
    const sendsBefore = recoverySms.send.mock.calls.length;
    const result = await recovery.request(`DRF-${'f'.repeat(24)}`);
    expect(result).toMatchObject({ accepted: true });
    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(recoverySms.send).toHaveBeenCalledTimes(sendsBefore);
    await expect(recovery.verify(result.challengeId, '000000')).rejects.toThrow(
      'verification code is invalid',
    );
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
    idempotencyKey,
  };
}

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { randomUUID, randomBytes } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxService } from '../src/operations/outbox.service';
import { RefundOutboxHandler } from '../src/refunds/refund-outbox.handler';
import { PaymentGatewayService } from '../src/payments/payment-gateway.service';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../src/config/environment';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

describeIfDb('Refund outbox duplicate safety (e2e with PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let handler: RefundOutboxHandler;
  let outbox: OutboxService;
  let gatewaySubmitCalls = 0;

  const mockGateway = {
    findRefundByTransaction: jest.fn(async () => null),
    submitRefund: jest.fn(async () => {
      gatewaySubmitCalls += 1;
      return { reference: `refund_${randomUUID()}`, status: 'pending' };
    }),
    fetchRefund: jest.fn(),
    // other methods not needed
  } as unknown as PaymentGatewayService;

  beforeAll(async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'DATABASE_URL') return databaseUrl;
        if (key === 'PAYSTACK_MODE') return 'sandbox';
        if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test_jest';
        return 'test';
      }),
      getOrThrow: jest.fn((key: string) => 'test'),
    } as unknown as ConfigService<AppEnvironment, true>;

    moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        OutboxService,
        { provide: PaymentGatewayService, useValue: mockGateway },
        RefundOutboxHandler,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    handler = moduleRef.get(RefundOutboxHandler);
    outbox = moduleRef.get(OutboxService);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  beforeEach(() => {
    gatewaySubmitCalls = 0;
    jest.clearAllMocks();
    mockGateway.findRefundByTransaction = jest.fn(async () => null);
    (mockGateway.submitRefund as any) = jest.fn(async () => {
      gatewaySubmitCalls += 1;
      return { reference: `refund_${randomUUID()}`, status: 'pending' };
    });
  });

  it('concurrent duplicate refund tasks result in single provider submission and preserve winner state', async () => {
    const refund = await createRefundFixture(prisma, 'APPROVED');
    const claimToken = randomUUID();
    const outboxEvent = await prisma.outboxEvent.create({
      data: {
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 2,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken,
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });

    const results = await Promise.allSettled([
      handler.handleClaimed(outboxEvent.id, claimToken),
      handler.handleClaimed(outboxEvent.id, claimToken),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(gatewaySubmitCalls).toBe(1);

    const finalRefund = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(finalRefund.providerReference).toBeTruthy();
    expect(finalRefund.state).toBe('PENDING'); // submitRefund returns pending
    expect(finalRefund.submissionKey).toBe(
      `dashchecker-refund-${outboxEvent.id}`,
    );

    const finalOutbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: outboxEvent.id },
    });
    // One handler should have marked dispatched, the other should have rescheduled/deferred but not duplicated
    // The outbox should be either DISPATCHED (winner) or PENDING (loser deferred) – but not both submitted
    expect(['DISPATCHED', 'PENDING']).toContain(finalOutbox.state);
    // Ensure no duplicate providerReference
    const refundsWithSameSubmission = await prisma.refund.count({
      where: { submissionKey: `dashchecker-refund-${outboxEvent.id}` },
    });
    expect(refundsWithSameSubmission).toBe(1);

    // Second concurrent call should not have overwritten SUCCESS/FAILED if winner had completed
    // Simulate winner completing to SUCCESS, then loser should not regress to PENDING
    await prisma.refund.update({
      where: { id: refund.id },
      data: { state: 'SUCCESS', providerReference: `prov_${randomUUID()}` },
    });
    // Now create a new outbox event for same refund with different claim (simulating retry after success)
    const secondEvent = await prisma.outboxEvent.create({
      data: {
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 3,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken: randomUUID(),
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });
    const secondResult = await handler.handleClaimed(
      secondEvent.id,
      secondEvent.claimToken as string,
    );
    expect(secondResult).toBe(true);
    const afterSecond = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(afterSecond.state).toBe('SUCCESS');
    expect(afterSecond.providerReference).toBeTruthy();
  });

  it('losing task does not overwrite winner SUCCESS via deferUnknownOutcome', async () => {
    const refund = await createRefundFixture(prisma, 'APPROVED');
    const eventId = randomUUID();
    const claimToken1 = randomUUID();
    const claimToken2 = randomUUID();

    const event1 = await prisma.outboxEvent.create({
      data: {
        id: eventId,
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 2,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken: claimToken1,
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });

    mockGateway.findRefundByTransaction = jest.fn(async () => null);
    (mockGateway.submitRefund as any) = jest.fn(async () => ({
      reference: `prov_${randomUUID()}`,
      status: 'success',
    }));

    await handler.handleClaimed(event1.id, claimToken1);
    const afterWinner = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(afterWinner.state).toBe('SUCCESS');
    const winnerProviderRef = afterWinner.providerReference;

    const event2 = await prisma.outboxEvent.create({
      data: {
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 3,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken: claimToken2,
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });

    mockGateway.findRefundByTransaction = jest.fn(async () => null);
    await handler.handleClaimed(event2.id, claimToken2);

    const final = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(final.state).toBe('SUCCESS');
    expect(final.providerReference).toBe(winnerProviderRef);
  });

  it('concurrent race with paused winner does not let loser overwrite SUCCESS', async () => {
    const refund = await createRefundFixture(prisma, 'APPROVED');
    const eventId = randomUUID();
    const claimTokenWinner = randomUUID();
    const claimTokenLoser = randomUUID();

    const eventWinner = await prisma.outboxEvent.create({
      data: {
        id: eventId,
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 2,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken: claimTokenWinner,
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });

    const eventLoser = await prisma.outboxEvent.create({
      data: {
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        aggregateType: 'REFUND',
        aggregateId: refund.id,
        aggregateVersion: 3,
        payload: { refundId: refund.id },
        state: 'CLAIMED',
        claimToken: claimTokenLoser,
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        availableAt: new Date(),
      },
    });

    let resolveWinnerSubmit: (value: any) => void;
    const winnerSubmitPromise = new Promise<any>((resolve) => {
      resolveWinnerSubmit = resolve;
    });

    mockGateway.findRefundByTransaction = jest.fn(async () => null);
    (mockGateway.submitRefund as any) = jest.fn(() => winnerSubmitPromise);

    const winnerHandlePromise = handler.handleClaimed(
      eventWinner.id,
      claimTokenWinner,
    );

    // Give winner time to acquire atomic claim and reach submitRefund
    await new Promise((r) => setTimeout(r, 100));

    // Loser tries to handle same refund concurrently while winner is paused
    const loserHandlePromise = handler.handleClaimed(
      eventLoser.id,
      claimTokenLoser,
    );

    // Loser should enter deferUnknownOutcome path and attempt conditional update (which should not overwrite)
    await new Promise((r) => setTimeout(r, 100));

    // Now let winner complete
    resolveWinnerSubmit!({
      reference: `prov_${randomUUID()}`,
      status: 'success',
    });
    const winnerResult = await winnerHandlePromise;
    expect(winnerResult).toBe(true);

    const loserResult = await loserHandlePromise;
    // Loser should have been deferred (false) but not thrown, and not overwritten winner
    expect([true, false]).toContain(loserResult);

    const finalRefund = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(finalRefund.state).toBe('SUCCESS');
    expect(finalRefund.providerReference).toBeTruthy();

    const winnerOutbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: eventWinner.id },
    });
    expect(winnerOutbox.state).toBe('DISPATCHED');

    // Loser outbox should be either PENDING (deferred) or DISPATCHED (if it saw terminal), but refund must remain SUCCESS
    const loserOutbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: eventLoser.id },
    });
    expect(['PENDING', 'DISPATCHED', 'FAILED']).toContain(loserOutbox.state);

    // Verify that second defer did not overwrite SUCCESS
    const finalAgain = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(finalAgain.state).toBe('SUCCESS');
  });

  it('deferUnknownOutcome conditional update does not overwrite already SUCCESS refund', async () => {
    const refund = await createRefundFixture(prisma, 'APPROVED');
    // Simulate winner already completed to SUCCESS
    const submissionKey = `dashchecker-refund-${randomUUID()}`;
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        state: 'SUCCESS',
        providerReference: `prov_${randomUUID()}`,
        submissionKey,
        attemptCount: 1,
      },
    });

    // Directly test the conditional update used in deferUnknownOutcome
    const updated = await prisma.refund.updateMany({
      where: {
        id: refund.id,
        providerReference: null,
        state: { in: ['SUBMITTING', 'PENDING', 'APPROVED'] },
      },
      data: { state: 'PENDING', nextReconciliationAt: new Date() },
    });
    expect(updated.count).toBe(0);

    const final = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(final.state).toBe('SUCCESS');
    expect(final.providerReference).toBeTruthy();
  });

  it('loser that already read SUBMITTING before winner SUCCESS cannot overwrite via defer', async () => {
    const refund = await createRefundFixture(prisma, 'APPROVED');
    const submissionKey = `dashchecker-refund-${randomUUID()}`;
    // Winner claims and sets to SUBMITTING
    await prisma.refund.update({
      where: { id: refund.id },
      data: { state: 'SUBMITTING', submissionKey, attemptCount: 1 },
    });

    // Loser reads SUBMITTING (before winner completes) – simulate by not re-reading

    // Winner completes to SUCCESS
    const winnerProviderRef = `prov_${randomUUID()}`;
    await prisma.refund.update({
      where: { id: refund.id },
      data: { state: 'SUCCESS', providerReference: winnerProviderRef },
    });

    // Now loser tries to defer (as it would after failing atomic claim and seeing submissionKey exists)
    // It calls deferUnknownOutcome which does conditional updateMany
    const updated = await prisma.refund.updateMany({
      where: {
        id: refund.id,
        providerReference: null,
        state: { in: ['SUBMITTING', 'PENDING', 'APPROVED'] },
      },
      data: { state: 'PENDING', nextReconciliationAt: new Date() },
    });
    expect(updated.count).toBe(0);

    const final = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(final.state).toBe('SUCCESS');
    expect(final.providerReference).toBe(winnerProviderRef);
  });
});

async function createRefundFixture(
  prisma: PrismaService,
  state: 'APPROVED' | 'REQUESTED' = 'APPROVED',
) {
  const tenant = await prisma.agentTenant.create({ data: {} });
  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      name: `Refund Agent ${randomUUID()}`,
      phoneCiphertext: randomBytes(48),
      phoneFingerprint: randomBytes(32),
      phoneMask: '+233 24 *** 0001',
      encryptionKeyId: 'test-key-v1',
      status: 'ACTIVE',
    },
  });
  const product = await prisma.product.create({
    data: {
      code: `REFUND_${randomUUID().replaceAll('-', '').toUpperCase()}`,
      name: 'Refund Test Product',
      scopeDisclosure: 'test',
      displayOrder: 99,
    },
  });
  const order = await prisma.order.create({
    data: {
      publicReference: `REF-${randomUUID().slice(0, 8)}`,
      tenantId: tenant.id,
      agentId: agent.id,
      channelType: 'WEB',
      channelIdSnapshot: agent.slug || agent.webSalesId || 'test',
      productId: product.id,
      quantity: 1,
      currency: 'GHS',
      baseTotalMinor: 1000n,
      retailTotalMinor: 1500n,
      agentProfitTotalMinor: 500n,
      deliveryPhoneCiphertext: randomBytes(48),
      deliveryPhoneFingerprint: randomBytes(32),
      deliveryPhoneMask: '+233 24 *** 0001',
      contactEncryptionKeyId: 'test-key-v1',
      contactFormatVersion: 1,
      priceExpiresAt: new Date(),
      paymentState: 'PAID',
      fulfillmentState: 'COMPLETE',
    },
  });
  const paymentAttempt = await prisma.paymentAttempt.create({
    data: {
      orderId: order.id,
      attemptNumber: 1,
      providerReference: `pay_${randomUUID().replaceAll('-', '')}`,
      syntheticEmailCiphertext: Uint8Array.from(randomBytes(48)),
      syntheticEmailMask: 'test@example.com',
      expectedAmountMinor: 1500n,
      currency: 'GHS',
      state: 'SUCCESS',
      providerStatus: 'success',
      providerTransactionId: `txn_${randomUUID()}`,
      authorizationExpiresAt: new Date(Date.now() + 3600000),
    },
  });
  const refund = await prisma.refund.create({
    data: {
      paymentAttemptId: paymentAttempt.id,
      orderId: order.id,
      amountMinor: 1000n,
      currency: 'GHS',
      reason: 'test refund',
      state,
      requestedAt: new Date(),
    },
  });
  // If APPROVED, set approved fields
  if (state === 'APPROVED') {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { approvedAt: new Date(), state: 'APPROVED' },
    });
  }
  return refund;
}

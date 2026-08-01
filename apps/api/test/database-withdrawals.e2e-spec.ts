import { randomBytes, randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { WithdrawalsService } from '../src/wallet/withdrawals.service';
import { OtpTokenService } from '../src/agent-access/otp-token.service';
import { AgentAuthService } from '../src/agent-access/agent-auth.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for withdrawal database tests',
  );
}
process.env.DATABASE_URL = databaseUrl;

describe('Withdrawal settlement and database invariants (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let withdrawals: WithdrawalsService;
  let otpTokens: OtpTokenService;
  let agentAuth: AgentAuthService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    withdrawals = moduleRef.get(WithdrawalsService);
    otpTokens = moduleRef.get(OtpTokenService);
    agentAuth = moduleRef.get(AgentAuthService);
  });

  afterAll(async () => moduleRef?.close());

  it('settles success exactly once and compensates a later reversal exactly once', async () => {
    const fixture = await createWithdrawalFixture(prisma, 'PENDING');
    const result = {
      reference: fixture.reference,
      transferCode: `TRF_${randomUUID()}`,
      status: 'success',
      amountMinor: 2_000n,
      currency: 'GHS',
    };

    await Promise.all([
      withdrawals.settleTransfer(result),
      withdrawals.settleTransfer(result),
    ]);

    let entries = await prisma.ledgerEntry.findMany({
      where: { walletAccountId: fixture.walletId },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => [entry.type, entry.amountMinor])).toEqual([
      ['SALE_CREDIT', 5_000n],
      ['PAYOUT_DEBIT', -2_000n],
      ['PAYOUT_FEE_DEBIT', -100n],
    ]);
    expect(await withdrawalState(prisma, fixture.withdrawalId)).toEqual({
      state: 'SUCCESS',
      holdState: 'CONSUMED',
    });

    const reversed = { ...result, status: 'reversed' };
    await withdrawals.settleTransfer(reversed);
    await withdrawals.settleTransfer(reversed);

    entries = await prisma.ledgerEntry.findMany({
      where: { walletAccountId: fixture.walletId },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.at(-1)).toMatchObject({
      type: 'PAYOUT_COMPENSATION_CREDIT',
      amountMinor: 2_000n,
    });
    expect(entries).toHaveLength(4);
    expect(await withdrawalState(prisma, fixture.withdrawalId)).toEqual({
      state: 'REVERSED',
      holdState: 'CONSUMED',
    });
  });

  it('allows only one of two concurrent requests to hold the same funds', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: `Concurrent Agent ${randomUUID()}`,
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0001',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });
    const wallet = await prisma.walletAccount.create({
      data: { agentId: agent.id, currency: 'GHS' },
    });
    await prisma.ledgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: 'SALE_CREDIT',
        amountMinor: 5_000n,
        sourceType: 'ORDER_SALE',
        sourceId: randomUUID(),
      },
    });
    const tokens = await Promise.all([
      createWithdrawalToken(prisma, otpTokens, agent),
      createWithdrawalToken(prisma, otpTokens, agent),
    ]);

    const results = await Promise.allSettled(
      tokens.map((withdrawalToken) =>
        withdrawals.request({
          agentId: agent.id,
          network: 'MTN',
          netAmountMinor: '3000',
          withdrawalToken,
        }),
      ),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.walletHold.aggregate({
        where: { walletAccountId: wallet.id, state: 'ACTIVE' },
        _sum: { amountMinor: true },
      }),
    ).toMatchObject({ _sum: { amountMinor: 3_100n } });
  });

  it('does not allow one authenticated agent to verify another agent withdrawal challenge', async () => {
    const tenantA = await prisma.agentTenant.create({ data: {} });
    const tenantB = await prisma.agentTenant.create({ data: {} });
    const [agentA, agentB] = await Promise.all([
      createAgent(prisma, tenantA.id, 'OTP Agent A'),
      createAgent(prisma, tenantB.id, 'OTP Agent B'),
    ]);
    const challengeId = randomUUID();
    const code = '123456';
    const challenge = await prisma.otpChallenge.create({
      data: {
        id: challengeId,
        purpose: 'AGENT_WITHDRAWAL',
        agentId: agentB.id,
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: agentB.phoneMask,
        encryptionKeyId: 'test-key-v1',
        verifierFingerprint: Uint8Array.from(
          otpTokens.codeFingerprint(challengeId, code),
        ),
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    await expect(
      agentAuth.verifyWithdrawalOtp(agentA.id, challenge.id, code),
    ).rejects.toThrow('The verification code is invalid');
    expect(
      await prisma.otpChallenge.findUniqueOrThrow({
        where: { id: challenge.id },
        select: { consumedAt: true, attemptCount: true },
      }),
    ).toEqual({ consumedAt: null, attemptCount: 0 });
  });

  it('queues durable transfer submission when an Administrator approves a request', async () => {
    const fixture = await createWithdrawalFixture(prisma, 'REQUESTED');
    const administrator = await prisma.internalUser.create({
      data: {
        displayName: `Withdrawal Administrator ${randomUUID()}`,
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
      },
    });

    const decided = await withdrawals.decide({
      withdrawalId: fixture.withdrawalId,
      approve: true,
      reason: 'Wallet and destination reviewed',
      requestId: randomUUID(),
      actor: {
        userId: administrator.id,
        sessionId: randomUUID(),
        displayName: administrator.displayName,
        role: 'ADMINISTRATOR',
        authenticationStrength: 'PHISHING_RESISTANT',
        authenticatedAt: new Date(),
        stepUpAt: null,
      },
    });

    expect(decided.state).toBe('APPROVED');
    expect(
      await prisma.outboxEvent.findFirst({
        where: {
          eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED',
          aggregateId: fixture.withdrawalId,
        },
        select: { state: true, payload: true },
      }),
    ).toEqual({
      state: 'PENDING',
      payload: { withdrawalId: fixture.withdrawalId },
    });
    expect(
      await prisma.auditEvent.findFirst({
        where: {
          action: 'WITHDRAWAL_APPROVED',
          entityId: fixture.withdrawalId,
        },
        select: { actorInternalUserId: true },
      }),
    ).toEqual({ actorInternalUserId: administrator.id });
  });

  it('releases a failed transfer without writing payout ledger entries', async () => {
    const fixture = await createWithdrawalFixture(prisma, 'PENDING');
    const result = {
      reference: fixture.reference,
      transferCode: `TRF_${randomUUID()}`,
      status: 'failed',
      amountMinor: 2_000n,
      currency: 'GHS',
    };

    await withdrawals.settleTransfer(result);
    await withdrawals.settleTransfer(result);

    expect(await withdrawalState(prisma, fixture.withdrawalId)).toEqual({
      state: 'FAILED',
      holdState: 'RELEASED',
    });
    expect(
      await prisma.ledgerEntry.count({
        where: {
          walletAccountId: fixture.walletId,
          type: { in: ['PAYOUT_DEBIT', 'PAYOUT_FEE_DEBIT'] },
        },
      }),
    ).toBe(0);
  });

  it('rejects mismatched provider settlement details and retains the hold', async () => {
    const fixture = await createWithdrawalFixture(prisma, 'PENDING');
    await expect(
      withdrawals.settleTransfer({
        reference: fixture.reference,
        transferCode: null,
        status: 'success',
        amountMinor: 1_999n,
        currency: 'GHS',
      }),
    ).rejects.toThrow('Transfer amount does not match withdrawal');
    expect(await withdrawalState(prisma, fixture.withdrawalId)).toEqual({
      state: 'PENDING',
      holdState: 'ACTIVE',
    });
  });

  it('enforces one transfer attempt per withdrawal and financial constraints in PostgreSQL', async () => {
    const fixture = await createWithdrawalFixture(prisma, 'APPROVED');
    await expect(
      prisma.transferAttempt.create({
        data: {
          withdrawalId: fixture.withdrawalId,
          providerReference: `doraf_wd_${randomUUID().replaceAll('-', '')}`,
          recipientCode: 'RCP_duplicate',
          providerStatus: 'creating',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.withdrawal.create({
        data: {
          agentId: fixture.agentId,
          walletAccountId: fixture.walletId,
          destinationMask: '+233 24 *** 0000',
          network: 'MTN',
          netAmountMinor: 999n,
          feeAmountMinor: 100n,
          holdAmountMinor: 1_099n,
        },
      }),
    ).rejects.toBeDefined();

    const another = await prisma.withdrawal.create({
      data: {
        agentId: fixture.agentId,
        walletAccountId: fixture.walletId,
        destinationMask: '+233 24 *** 0000',
        network: 'MTN',
        netAmountMinor: 1_000n,
        feeAmountMinor: 100n,
        holdAmountMinor: 1_100n,
      },
    });
    await expect(
      prisma.walletHold.create({
        data: {
          withdrawalId: another.id,
          walletAccountId: fixture.walletId,
          amountMinor: 1_200n,
        },
      }),
    ).rejects.toBeDefined();
  });
});

async function createWithdrawalFixture(
  prisma: PrismaService,
  state: 'REQUESTED' | 'APPROVED' | 'PENDING',
) {
  const tenant = await prisma.agentTenant.create({ data: {} });
  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      name: `Withdrawal Agent ${randomUUID()}`,
      phoneCiphertext: randomBytes(48),
      phoneFingerprint: randomBytes(32),
      phoneMask: '+233 24 *** 0000',
      encryptionKeyId: 'test-key-v1',
      status: 'ACTIVE',
    },
  });
  const wallet = await prisma.walletAccount.create({
    data: { agentId: agent.id, currency: 'GHS' },
  });
  await prisma.ledgerEntry.create({
    data: {
      walletAccountId: wallet.id,
      type: 'SALE_CREDIT',
      amountMinor: 5_000n,
      sourceType: 'ORDER_SALE',
      sourceId: randomUUID(),
    },
  });
  const withdrawal = await prisma.withdrawal.create({
    data: {
      agentId: agent.id,
      walletAccountId: wallet.id,
      destinationMask: agent.phoneMask,
      network: 'MTN',
      netAmountMinor: 2_000n,
      feeAmountMinor: 100n,
      holdAmountMinor: 2_100n,
      state,
      hold: {
        create: { walletAccountId: wallet.id, amountMinor: 2_100n },
      },
    },
  });
  const reference = `doraf_wd_${withdrawal.id.replaceAll('-', '')}`;
  if (state !== 'REQUESTED') {
    await prisma.transferAttempt.create({
      data: {
        withdrawalId: withdrawal.id,
        providerReference: reference,
        recipientCode: 'RCP_test',
        providerStatus: 'pending',
      },
    });
  }
  return {
    agentId: agent.id,
    walletId: wallet.id,
    withdrawalId: withdrawal.id,
    reference,
  };
}

async function createAgent(
  prisma: PrismaService,
  tenantId: string,
  name: string,
) {
  return prisma.agent.create({
    data: {
      tenantId,
      name: `${name} ${randomUUID()}`,
      phoneCiphertext: randomBytes(48),
      phoneFingerprint: randomBytes(32),
      phoneMask: '+233 24 *** 0002',
      encryptionKeyId: 'test-key-v1',
      status: 'ACTIVE',
    },
  });
}

async function withdrawalState(prisma: PrismaService, withdrawalId: string) {
  const withdrawal = await prisma.withdrawal.findUniqueOrThrow({
    where: { id: withdrawalId },
    include: { hold: true },
  });
  return { state: withdrawal.state, holdState: withdrawal.hold?.state };
}

async function createWithdrawalToken(
  prisma: PrismaService,
  otpTokens: OtpTokenService,
  agent: {
    id: string;
    phoneCiphertext: Uint8Array;
    phoneFingerprint: Uint8Array;
    phoneMask: string;
    encryptionKeyId: string;
  },
) {
  const completion = otpTokens.createCompletionToken();
  await prisma.otpChallenge.create({
    data: {
      purpose: 'AGENT_WITHDRAWAL',
      agentId: agent.id,
      phoneCiphertext: Uint8Array.from(agent.phoneCiphertext),
      phoneFingerprint: Uint8Array.from(agent.phoneFingerprint),
      phoneMask: agent.phoneMask,
      encryptionKeyId: agent.encryptionKeyId,
      verifierFingerprint: randomBytes(32),
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 300_000),
      consumedAt: new Date(),
      completionTokenFingerprint: Uint8Array.from(completion.fingerprint),
      completionExpiresAt: new Date(Date.now() + 300_000),
    },
  });
  return completion.token;
}

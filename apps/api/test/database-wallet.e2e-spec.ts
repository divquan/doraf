import { randomBytes, randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { WalletService } from '../src/wallet/wallet.service';
import { PrismaService } from '../src/database/prisma.service';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for database wallet integration tests',
  );
}

process.env.DATABASE_URL = databaseUrl;

describe('Wallet database integration & immutability (e2e)', () => {
  let moduleRef: TestingModule;
  let walletService: WalletService;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    walletService = moduleRef.get(WalletService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('returns zero summary and empty transactions for uninitialized agent without DB side effects', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Uninitialized Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0001',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });

    const summary = await walletService.getSummary(agent.id);
    expect(summary).toEqual({
      ledgerBalanceMinor: '0',
      activeHoldsMinor: '0',
      withdrawableMinor: '0',
      currency: 'GHS',
      isNegative: false,
      negativeBalanceMinor: '0',
    });

    const history = await walletService.getTransactions(agent.id, {
      page: 1,
      limit: 10,
    });
    expect(history.items).toEqual([]);
    expect(history.pagination.totalItems).toBe(0);

    const walletCheck = await prisma.walletAccount.findUnique({
      where: { agentId: agent.id },
    });
    expect(walletCheck).toBeNull();
  });

  it('aggregates signed ledger entries and enforces two-agent isolation', async () => {
    const tenantA = await prisma.agentTenant.create({ data: {} });
    const tenantB = await prisma.agentTenant.create({ data: {} });

    const agentA = await prisma.agent.create({
      data: {
        tenantId: tenantA.id,
        name: 'Agent A',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0002',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });

    const agentB = await prisma.agent.create({
      data: {
        tenantId: tenantB.id,
        name: 'Agent B',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0003',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });

    const walletA = await prisma.walletAccount.create({
      data: { agentId: agentA.id, currency: 'GHS' },
    });
    const walletB = await prisma.walletAccount.create({
      data: { agentId: agentB.id, currency: 'GHS' },
    });

    // Agent A entries: +2500, -500 -> net +2000
    await prisma.ledgerEntry.create({
      data: {
        walletAccountId: walletA.id,
        type: 'SALE_CREDIT',
        amountMinor: 2500n,
        currency: 'GHS',
        sourceType: 'ORDER_SALE',
        sourceId: 'order-1',
        createdAt: new Date(Date.now() - 120000),
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        walletAccountId: walletA.id,
        type: 'SALE_REVERSAL_DEBIT',
        amountMinor: -500n,
        currency: 'GHS',
        sourceType: 'PAYMENT_REVERSAL',
        sourceId: 'rev-1',
        createdAt: new Date(Date.now() - 60000),
      },
    });

    // Agent B entries: +5000 -> net +5000
    await prisma.ledgerEntry.create({
      data: {
        walletAccountId: walletB.id,
        type: 'SALE_CREDIT',
        amountMinor: 5000n,
        currency: 'GHS',
        sourceType: 'ORDER_SALE',
        sourceId: 'order-2',
      },
    });

    const summaryA = await walletService.getSummary(agentA.id);
    expect(summaryA.ledgerBalanceMinor).toBe('2000');
    expect(summaryA.withdrawableMinor).toBe('2000');
    expect(summaryA.isNegative).toBe(false);

    const summaryB = await walletService.getSummary(agentB.id);
    expect(summaryB.ledgerBalanceMinor).toBe('5000');

    const historyA = await walletService.getTransactions(agentA.id, {
      page: 1,
      limit: 10,
    });
    expect(historyA.items.length).toBe(2);
    expect(historyA.items[0].description).toBe('Sale payment reversal');
    expect(historyA.items[0].amountMinor).toBe('-500');
    expect(historyA.items[1].description).toBe('Sale profit credit');
    expect(historyA.items[1].amountMinor).toBe('2500');
  });

  it('correctly handles negative balance calculation', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Negative Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0004',
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
        amountMinor: 1000n,
        currency: 'GHS',
        sourceType: 'ORDER_SALE',
        sourceId: 'order-neg',
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: 'SALE_REVERSAL_DEBIT',
        amountMinor: -2500n,
        currency: 'GHS',
        sourceType: 'PAYMENT_REVERSAL',
        sourceId: 'rev-neg',
      },
    });

    const summary = await walletService.getSummary(agent.id);
    expect(summary.ledgerBalanceMinor).toBe('-1500');
    expect(summary.withdrawableMinor).toBe('0');
    expect(summary.isNegative).toBe(true);
    expect(summary.negativeBalanceMinor).toBe('1500');
  });

  it('paginates deterministically and normalizes an out-of-range page', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Paginated Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0006',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });
    const wallet = await prisma.walletAccount.create({
      data: { agentId: agent.id, currency: 'GHS' },
    });
    const createdAt = new Date('2026-08-01T12:00:00.000Z');

    const entries = [
      {
        id: randomUUID(),
        amountMinor: 100n,
        sourceId: 'pagination-1',
      },
      {
        id: randomUUID(),
        amountMinor: 200n,
        sourceId: 'pagination-2',
      },
      {
        id: randomUUID(),
        amountMinor: 300n,
        sourceId: 'pagination-3',
      },
    ];
    const expectedAmounts = [...entries]
      .sort((left, right) => right.id.localeCompare(left.id))
      .map((entry) => entry.amountMinor.toString());

    await prisma.ledgerEntry.createMany({
      data: entries.map((entry) => ({
        ...entry,
        walletAccountId: wallet.id,
        type: 'SALE_CREDIT',
        currency: 'GHS',
        sourceType: 'ORDER_SALE',
        createdAt,
      })),
    });

    const firstPage = await walletService.getTransactions(agent.id, {
      page: 1,
      limit: 2,
    });
    expect(firstPage.items.map((item) => item.amountMinor)).toEqual(
      expectedAmounts.slice(0, 2),
    );
    expect(firstPage.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 2,
      hasNextPage: true,
    });

    const lastPage = await walletService.getTransactions(agent.id, {
      page: 99,
      limit: 2,
    });
    expect(lastPage.items.map((item) => item.amountMinor)).toEqual(
      expectedAmounts.slice(2),
    );
    expect(lastPage.pagination).toMatchObject({
      currentPage: 2,
      totalPages: 2,
      hasNextPage: false,
    });
  });

  it('enforces database-level ledger_entry immutability (rejects UPDATE and DELETE)', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Immutable Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '+233 24 *** 0005',
        encryptionKeyId: 'test-key-v1',
        status: 'ACTIVE',
      },
    });

    const wallet = await prisma.walletAccount.create({
      data: { agentId: agent.id, currency: 'GHS' },
    });

    const entry = await prisma.ledgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: 'SALE_CREDIT',
        amountMinor: 3000n,
        currency: 'GHS',
        sourceType: 'ORDER_SALE',
        sourceId: 'order-imm',
      },
    });

    await expect(
      prisma.$executeRaw`UPDATE ledger_entry SET amount_minor = 9999 WHERE id = ${entry.id}::uuid`,
    ).rejects.toThrow(/append-only/i);

    await expect(
      prisma.$executeRaw`DELETE FROM ledger_entry WHERE id = ${entry.id}::uuid`,
    ).rejects.toThrow(/append-only/i);
  });
});

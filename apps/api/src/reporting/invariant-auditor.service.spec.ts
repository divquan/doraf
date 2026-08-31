import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../operations/outbox.service';
import { InvariantAuditorService } from './invariant-auditor.service';

describe('InvariantAuditorService', () => {
  let service: InvariantAuditorService;
  let prisma: {
    walletAccount: { findMany: jest.Mock };
    product: { findMany: jest.Mock };
    voucher: { groupBy: jest.Mock };
    order: { count: jest.Mock };
    outboxEvent: {
      findMany: jest.Mock;
    };
  };
  let outbox: { reclaimExpiredClaims: jest.Mock };

  beforeEach(async () => {
    prisma = {
      walletAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wallet-1',
            agentId: 'agent-1',
            ledgerEntries: [{ amountMinor: 10_000n }],
            holds: [{ amountMinor: 2_000n }],
          },
        ]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-1',
            code: 'BECE',
            _count: { vouchers: 100 },
          },
        ]),
      },
      voucher: {
        groupBy: jest.fn().mockResolvedValue([
          { availability: 'AVAILABLE', _count: { _all: 90 } },
          { availability: 'SOLD', _count: { _all: 10 } },
        ]),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
      },
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    outbox = {
      reclaimExpiredClaims: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvariantAuditorService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    service = module.get<InvariantAuditorService>(InvariantAuditorService);
  });

  it('reports HEALTHY when all invariant checks pass', async () => {
    const report = await service.runFullAudit();

    expect(report.status).toBe('HEALTHY');
    expect(report.checks).toHaveLength(4);
    expect(report.checks.every((c) => c.status === 'PASS')).toBe(true);
  });

  it('reports DISCREPANCY_DETECTED when a wallet is overspent', async () => {
    prisma.walletAccount.findMany.mockResolvedValueOnce([
      {
        id: 'wallet-overspent',
        agentId: 'agent-2',
        ledgerEntries: [{ amountMinor: 1_000n }],
        holds: [{ amountMinor: 5_000n }],
      },
    ]);

    const report = await service.runFullAudit();

    expect(report.status).toBe('DISCREPANCY_DETECTED');
    const walletCheck = report.checks.find(
      (c) => c.code === 'WALLET_LEDGER_INTEGRITY',
    );
    expect(walletCheck?.status).toBe('FAIL');
    expect(walletCheck?.anomalyCount).toBe(1);
  });
});

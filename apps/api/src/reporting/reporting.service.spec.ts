import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { InvariantAuditorService } from './invariant-auditor.service';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  let service: ReportingService;
  let auditor: { runFullAudit: jest.Mock };
  let prisma: {
    order: { aggregate: jest.Mock; count: jest.Mock };
    ledgerEntry: { aggregate: jest.Mock };
    walletHold: { aggregate: jest.Mock };
    withdrawal: { aggregate: jest.Mock };
    deliveryMessage: { groupBy: jest.Mock };
    product: { findMany: jest.Mock };
    voucherAllocation: { count: jest.Mock };
    agent: { count: jest.Mock };
    outboxEvent: { count: jest.Mock };
  };

  beforeEach(async () => {
    auditor = {
      runFullAudit: jest.fn().mockResolvedValue({
        status: 'HEALTHY',
        auditedAt: new Date().toISOString(),
        checks: [],
      }),
    };
    prisma = {
      order: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { retailTotalMinor: 15_000n },
        }),
        count: jest
          .fn()
          .mockResolvedValueOnce(10) // total
          .mockResolvedValueOnce(8) // paid
          .mockResolvedValueOnce(2), // unpaid
      },
      ledgerEntry: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amountMinor: 3_000n } }) // commissions
          .mockResolvedValueOnce({ _sum: { amountMinor: 12_000n } }), // ledger total
      },
      walletHold: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountMinor: 2_000n },
        }),
      },
      withdrawal: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { netAmountMinor: 1_000n },
        }),
      },
      deliveryMessage: {
        groupBy: jest.fn().mockResolvedValue([
          { state: 'DELIVERED', _count: { _all: 8 } },
          { state: 'FAILED', _count: { _all: 1 } },
        ]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-1',
            code: 'BECE',
            name: 'BECE Results',
            _count: { vouchers: 50 },
          },
        ]),
      },
      voucherAllocation: {
        count: jest.fn().mockResolvedValue(12),
      },
      agent: {
        count: jest
          .fn()
          .mockResolvedValueOnce(5) // active
          .mockResolvedValueOnce(1), // suspended
      },
      outboxEvent: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvariantAuditorService, useValue: auditor },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
  });

  it('aggregates financial, fulfillment, and operations stats correctly', async () => {
    const result = await service.getAdminOverview();

    expect(result.invariants.status).toBe('HEALTHY');
    expect(result.financial.totalGrossSalesMinor).toBe('15000');
    expect(result.financial.totalAgentCommissionsMinor).toBe('3000');
    expect(result.financial.totalPlatformNetMinor).toBe('12000');
    expect(result.financial.totalActiveWalletBalancesMinor).toBe('12000');
    expect(result.financial.totalActiveHoldsMinor).toBe('2000');
    expect(result.financial.pendingWithdrawalCount).toBe(1);
    const withdrawalAggregate = prisma.withdrawal
      .aggregate as unknown as jest.MockedFunction<
      (args: { where: { state: { in: string[] } } }) => Promise<unknown>
    >;
    const withdrawalAggregateCall = withdrawalAggregate.mock.calls[0]?.[0];
    expect(withdrawalAggregateCall?.where.state.in).toContain(
      'AWAITING_MANUAL_PAYMENT',
    );

    expect(result.fulfillment.totalOrders).toBe(10);
    expect(result.fulfillment.paidOrders).toBe(8);
    expect(result.fulfillment.deliveriesCount.delivered).toBe(8);
    expect(result.fulfillment.deliveriesCount.failed).toBe(1);
    expect(result.fulfillment.productSales).toEqual([
      {
        productCode: 'BECE',
        productName: 'BECE Results',
        soldCount: 12,
        availableStock: 50,
      },
    ]);

    expect(result.operations.activeAgentCount).toBe(5);
    expect(result.operations.suspendedAgentCount).toBe(1);
    expect(result.operations.pendingOutboxCount).toBe(0);
  });
});

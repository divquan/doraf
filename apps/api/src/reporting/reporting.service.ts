import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WalletHoldState, WithdrawalState } from '../generated/prisma/client';
import {
  InvariantAuditorService,
  type InvariantAuditReport,
} from './invariant-auditor.service';

export interface AdminReportingOverview {
  invariants: InvariantAuditReport;
  financial: {
    totalGrossSalesMinor: string;
    totalAgentCommissionsMinor: string;
    totalPlatformNetMinor: string;
    totalActiveWalletBalancesMinor: string;
    totalActiveHoldsMinor: string;
    pendingWithdrawalCount: number;
    pendingWithdrawalAmountMinor: string;
  };
  fulfillment: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    deliveriesCount: {
      pending: number;
      submitted: number;
      delivered: number;
      failed: number;
    };
    productSales: Array<{
      productCode: string;
      productName: string;
      soldCount: number;
      availableStock: number;
    }>;
  };
  operations: {
    activeAgentCount: number;
    suspendedAgentCount: number;
    pendingOutboxCount: number;
  };
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditor: InvariantAuditorService,
  ) {}

  async getAdminOverview(): Promise<AdminReportingOverview> {
    const [
      invariants,
      grossSales,
      commissions,
      ledgerTotal,
      activeHolds,
      pendingWithdrawals,
      orderStats,
      deliveries,
      products,
      agentStats,
      outboxPending,
    ] = await Promise.all([
      this.auditor.runFullAudit(),
      this.prisma.order.aggregate({
        where: { paymentState: 'PAID' },
        _sum: { retailTotalMinor: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { type: 'SALE_CREDIT' },
        _sum: { amountMinor: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountMinor: true },
      }),
      this.prisma.walletHold.aggregate({
        where: { state: WalletHoldState.ACTIVE },
        _sum: { amountMinor: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: {
          state: {
            in: [
              WithdrawalState.REQUESTED,
              WithdrawalState.APPROVED,
              WithdrawalState.AWAITING_MERCHANT_OTP,
              WithdrawalState.SUBMITTED,
              WithdrawalState.PENDING,
            ],
          },
        },
        _count: { _all: true },
        _sum: { netAmountMinor: true },
      }),
      Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({ where: { paymentState: 'PAID' } }),
        this.prisma.order.count({ where: { paymentState: 'UNPAID' } }),
      ]),
      this.prisma.deliveryMessage.groupBy({
        by: ['state'],
        _count: { _all: true },
      }),
      this.prisma.product.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          _count: {
            select: {
              vouchers: { where: { availability: 'AVAILABLE' } },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      Promise.all([
        this.prisma.agent.count({ where: { status: 'ACTIVE' } }),
        this.prisma.agent.count({ where: { status: 'SUSPENDED' } }),
      ]),
      this.prisma.outboxEvent.count({ where: { state: 'PENDING' } }),
    ]);

    const productSalesData = await Promise.all(
      products.map(async (prod) => {
        const soldCount = await this.prisma.voucherAllocation.count({
          where: {
            voucher: { productId: prod.id },
          },
        });
        return {
          productCode: prod.code,
          productName: prod.name,
          soldCount,
          availableStock: prod._count.vouchers,
        };
      }),
    );

    const grossSalesMinor = grossSales._sum?.retailTotalMinor ?? 0n;
    const commissionsMinor = commissions._sum?.amountMinor ?? 0n;
    const netPlatformMinor =
      grossSalesMinor > commissionsMinor
        ? grossSalesMinor - commissionsMinor
        : 0n;

    const deliveryStateCounts = {
      pending: 0,
      submitted: 0,
      delivered: 0,
      failed: 0,
    };
    for (const d of deliveries) {
      if (d.state === 'PENDING') deliveryStateCounts.pending = d._count._all;
      if (d.state === 'SUBMITTED')
        deliveryStateCounts.submitted = d._count._all;
      if (d.state === 'DELIVERED')
        deliveryStateCounts.delivered = d._count._all;
      if (d.state === 'FAILED') deliveryStateCounts.failed = d._count._all;
    }

    return {
      invariants,
      financial: {
        totalGrossSalesMinor: grossSalesMinor.toString(),
        totalAgentCommissionsMinor: commissionsMinor.toString(),
        totalPlatformNetMinor: netPlatformMinor.toString(),
        totalActiveWalletBalancesMinor: (
          ledgerTotal._sum?.amountMinor ?? 0n
        ).toString(),
        totalActiveHoldsMinor: (activeHolds._sum?.amountMinor ?? 0n).toString(),
        pendingWithdrawalCount: pendingWithdrawals._count._all,
        pendingWithdrawalAmountMinor: (
          pendingWithdrawals._sum?.netAmountMinor ?? 0n
        ).toString(),
      },
      fulfillment: {
        totalOrders: orderStats[0],
        paidOrders: orderStats[1],
        pendingOrders: orderStats[2],
        deliveriesCount: deliveryStateCounts,
        productSales: productSalesData,
      },
      operations: {
        activeAgentCount: agentStats[0],
        suspendedAgentCount: agentStats[1],
        pendingOutboxCount: outboxPending,
      },
    };
  }

  async getInvariantsReport(): Promise<InvariantAuditReport> {
    return this.auditor.runFullAudit();
  }

  async requeueStuckOutbox() {
    return this.auditor.requeueStuckOutboxEvents();
  }
}

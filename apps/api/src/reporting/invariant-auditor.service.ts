import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WalletHoldState } from '../generated/prisma/client';

export type InvariantCheckStatus = 'PASS' | 'FAIL';

export interface StuckOutboxDetail {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  state: string;
  lastError: string | null;
  createdAt: string;
}

export interface InvariantCheckResult {
  code: string;
  name: string;
  status: InvariantCheckStatus;
  details: string;
  anomalyCount: number;
  stuckEvents?: StuckOutboxDetail[];
}

export interface InvariantAuditReport {
  status: 'HEALTHY' | 'DISCREPANCY_DETECTED';
  auditedAt: string;
  checks: InvariantCheckResult[];
}

const INFORMATIONAL_EVENT_TYPES = [
  'PRODUCT_PRICING_POLICY_CREATED',
  'AGENT_PRICING_OVERRIDE_CREATED',
  'AGENT_PRICING_OVERRIDE_CLOSED',
  'AGENT_RETAIL_PRICE_SET',
  'PAYMENT_INITIALIZATION_REQUESTED',
  'RESERVATION_EXPIRY_DUE',
];

@Injectable()
export class InvariantAuditorService {
  private readonly logger = new Logger(InvariantAuditorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runFullAudit(): Promise<InvariantAuditReport> {
    const [walletCheck, inventoryCheck, fulfillmentCheck, outboxCheck] =
      await Promise.all([
        this.checkWalletInvariants(),
        this.checkInventoryInvariants(),
        this.checkFulfillmentInvariants(),
        this.checkOutboxInvariants(),
      ]);

    const checks = [walletCheck, inventoryCheck, fulfillmentCheck, outboxCheck];
    const discrepancyDetected = checks.some((c) => c.status === 'FAIL');

    if (discrepancyDetected) {
      this.logger.error(
        `Invariant discrepancy detected! Failed checks: ${checks
          .filter((c) => c.status === 'FAIL')
          .map((c) => c.code)
          .join(', ')}`,
      );
    }

    return {
      status: discrepancyDetected ? 'DISCREPANCY_DETECTED' : 'HEALTHY',
      auditedAt: new Date().toISOString(),
      checks,
    };
  }

  async requeueStuckOutboxEvents() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [claimedReset, informationalDispatched] = await Promise.all([
      this.prisma.outboxEvent.updateMany({
        where: {
          state: 'CLAIMED',
          createdAt: { lt: tenMinutesAgo },
        },
        data: { state: 'PENDING' },
      }),
      this.prisma.outboxEvent.updateMany({
        where: {
          state: 'PENDING',
          createdAt: { lt: tenMinutesAgo },
          eventType: { in: INFORMATIONAL_EVENT_TYPES },
        },
        data: { state: 'DISPATCHED', dispatchedAt: new Date() },
      }),
    ]);
    return {
      requeuedCount: claimedReset.count + informationalDispatched.count,
    };
  }

  private async checkWalletInvariants(): Promise<InvariantCheckResult> {
    const wallets = await this.prisma.walletAccount.findMany({
      select: {
        id: true,
        agentId: true,
        ledgerEntries: {
          select: { amountMinor: true },
        },
        holds: {
          where: { state: WalletHoldState.ACTIVE },
          select: { amountMinor: true },
        },
      },
    });

    let overspentCount = 0;
    for (const wallet of wallets) {
      const balanceMinor = wallet.ledgerEntries.reduce(
        (sum, entry) => sum + entry.amountMinor,
        0n,
      );
      const activeHoldsMinor = wallet.holds.reduce(
        (sum, hold) => sum + hold.amountMinor,
        0n,
      );
      const availableMinor = balanceMinor - activeHoldsMinor;
      if (availableMinor < 0n) {
        overspentCount += 1;
      }
    }

    return {
      code: 'WALLET_LEDGER_INTEGRITY',
      name: 'Wallet Ledger & Hold Balance Consistency',
      status: overspentCount === 0 ? 'PASS' : 'FAIL',
      details:
        overspentCount === 0
          ? `All ${wallets.length} wallets have valid withdrawable balances`
          : `${overspentCount} wallet(s) exhibit overspent or negative available balances`,
      anomalyCount: overspentCount,
    };
  }

  private async checkInventoryInvariants(): Promise<InvariantCheckResult> {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        code: true,
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    });

    let mismatchCount = 0;
    for (const prod of products) {
      const availabilities = await this.prisma.voucher.groupBy({
        by: ['availability'],
        where: { productId: prod.id },
        _count: { _all: true },
      });
      const groupedTotal = availabilities.reduce(
        (sum, item) => sum + item._count._all,
        0,
      );
      if (groupedTotal !== prod._count.vouchers) {
        mismatchCount += 1;
      }
    }

    return {
      code: 'INVENTORY_STOCK_CONSISTENCY',
      name: 'Inventory Stock & Availability Grouping',
      status: mismatchCount === 0 ? 'PASS' : 'FAIL',
      details:
        mismatchCount === 0
          ? `All ${products.length} product catalogs match total imported voucher counts`
          : `${mismatchCount} product(s) have voucher status count mismatches`,
      anomalyCount: mismatchCount,
    };
  }

  private async checkFulfillmentInvariants(): Promise<InvariantCheckResult> {
    const paidOrdersWithoutAllocations = await this.prisma.order.count({
      where: {
        paymentState: 'PAID',
        items: {
          some: {
            allocation: null,
          },
        },
      },
    });

    return {
      code: 'ORDER_FULFILLMENT_ALLOCATIONS',
      name: 'Paid Order Voucher Allocations',
      status: paidOrdersWithoutAllocations === 0 ? 'PASS' : 'FAIL',
      details:
        paidOrdersWithoutAllocations === 0
          ? 'All paid orders have complete voucher allocations'
          : `${paidOrdersWithoutAllocations} paid order(s) are missing voucher allocations`,
      anomalyCount: paidOrdersWithoutAllocations,
    };
  }

  private async checkOutboxInvariants(): Promise<InvariantCheckResult> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckEvents = await this.prisma.outboxEvent.findMany({
      where: {
        state: { in: ['PENDING', 'CLAIMED'] },
        createdAt: { lt: tenMinutesAgo },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        aggregateType: true,
        aggregateId: true,
        state: true,
        lastError: true,
        createdAt: true,
      },
    });

    const totalStuck = stuckEvents.length;

    return {
      code: 'OUTBOX_QUEUE_STUCK_WORK',
      name: 'Outbox Event Processing Latency',
      status: totalStuck === 0 ? 'PASS' : 'FAIL',
      details:
        totalStuck === 0
          ? 'Outbox processing queue is clear'
          : `${totalStuck} outbox event(s) have been stuck pending > 10 minutes`,
      anomalyCount: totalStuck,
      stuckEvents: stuckEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}

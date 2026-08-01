import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { LedgerEntryType } from '../generated/prisma/client';
import type { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto';
import type {
  PaginatedTransactionsDto,
  TransactionItemDto,
  WalletSummaryDto,
} from './wallet.types';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(agentId: string): Promise<WalletSummaryDto> {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { agentId },
      select: { id: true, currency: true },
    });

    if (!wallet) {
      return {
        ledgerBalanceMinor: '0',
        activeHoldsMinor: '0',
        withdrawableMinor: '0',
        currency: 'GHS',
        isNegative: false,
        negativeBalanceMinor: '0',
      };
    }

    const [aggregate, holds] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { walletAccountId: wallet.id },
        _sum: { amountMinor: true },
      }),
      this.prisma.walletHold.aggregate({
        where: { walletAccountId: wallet.id, state: 'ACTIVE' },
        _sum: { amountMinor: true },
      }),
    ]);

    const ledgerBalanceMinor = aggregate._sum.amountMinor ?? 0n;
    const activeHoldsMinor = holds._sum.amountMinor ?? 0n;
    const withdrawableMinor =
      ledgerBalanceMinor > activeHoldsMinor
        ? ledgerBalanceMinor - activeHoldsMinor
        : 0n;
    const isNegative = ledgerBalanceMinor < 0n;
    const negativeBalanceMinor = isNegative ? -ledgerBalanceMinor : 0n;

    return {
      ledgerBalanceMinor: ledgerBalanceMinor.toString(),
      activeHoldsMinor: activeHoldsMinor.toString(),
      withdrawableMinor: withdrawableMinor.toString(),
      currency: wallet.currency,
      isNegative,
      negativeBalanceMinor: negativeBalanceMinor.toString(),
    };
  }

  async getTransactions(
    agentId: string,
    query: WalletTransactionsQueryDto,
  ): Promise<PaginatedTransactionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const wallet = await this.prisma.walletAccount.findUnique({
      where: { agentId },
      select: { id: true },
    });

    if (!wallet) {
      return {
        items: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          limit,
          hasNextPage: false,
        },
      };
    }

    const where = {
      walletAccountId: wallet.id,
      ...(query.type ? { type: query.type } : {}),
    };

    const totalItems = await this.prisma.ledgerEntry.count({ where });
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (currentPage - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        amountMinor: true,
        currency: true,
        order: {
          select: { publicReference: true },
        },
        createdAt: true,
      },
    });

    const items: TransactionItemDto[] = entries.map((entry) => {
      const orderReference = entry.order?.publicReference
        ? `Order ${entry.order.publicReference}`
        : undefined;
      return {
        id: entry.id,
        type: entry.type,
        amountMinor: entry.amountMinor.toString(),
        currency: entry.currency,
        description: formatLedgerEntryDescription(
          entry.type,
          entry.order?.publicReference,
        ),
        createdAt: entry.createdAt.toISOString(),
        ...(orderReference ? { orderReference } : {}),
      };
    });

    return {
      items,
      pagination: {
        totalItems,
        totalPages,
        currentPage,
        limit,
        hasNextPage: currentPage < totalPages,
      },
    };
  }
}

export function formatLedgerEntryDescription(
  type: LedgerEntryType,
  orderReference?: string | null,
): string {
  const orderSuffix = orderReference ? ` (Order ${orderReference})` : '';
  switch (type) {
    case 'SALE_CREDIT':
      return `Sale profit credit${orderSuffix}`;
    case 'SALE_REVERSAL_DEBIT':
      return `Sale payment reversal${orderSuffix}`;
    case 'PAYOUT_DEBIT':
      return 'Withdrawal payout';
    case 'PAYOUT_FEE_DEBIT':
      return 'Withdrawal fee';
    case 'PAYOUT_COMPENSATION_CREDIT':
      return 'Returned withdrawal funds';
    case 'ADJUSTMENT_CREDIT':
      return 'Account credit adjustment';
    case 'ADJUSTMENT_DEBIT':
      return 'Account debit adjustment';
    default:
      return assertNever(type);
  }
}

function assertNever(x: never): never {
  throw new Error(`Unexpected ledger entry type: ${String(x)}`);
}

import type { LedgerEntryType } from '../generated/prisma/client';

export interface WalletSummaryDto {
  ledgerBalanceMinor: string;
  activeHoldsMinor: string;
  withdrawableMinor: string;
  currency: string;
  isNegative: boolean;
  negativeBalanceMinor: string;
}

export interface TransactionItemDto {
  id: string;
  type: LedgerEntryType;
  amountMinor: string;
  currency: string;
  description: string;
  createdAt: string;
  orderReference?: string;
}

export interface PaginationMetadataDto {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
}

export interface PaginatedTransactionsDto {
  items: TransactionItemDto[];
  pagination: PaginationMetadataDto;
}

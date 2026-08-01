import { formatLedgerEntryDescription } from './wallet.service';
import type { LedgerEntryType } from '../generated/prisma/client';

describe('formatLedgerEntryDescription', () => {
  const allTypes: LedgerEntryType[] = [
    'SALE_CREDIT',
    'SALE_REVERSAL_DEBIT',
    'PAYOUT_DEBIT',
    'PAYOUT_FEE_DEBIT',
    'ADJUSTMENT_CREDIT',
    'ADJUSTMENT_DEBIT',
  ];

  it('maps every LedgerEntryType exhaustively to a human-readable string', () => {
    for (const type of allTypes) {
      const description = formatLedgerEntryDescription(type, null);
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it('includes the public order reference when one is provided', () => {
    const orderReference = 'DRF-7CFFB3A52C';
    const saleCredit = formatLedgerEntryDescription(
      'SALE_CREDIT',
      orderReference,
    );
    expect(saleCredit).toBe('Sale profit credit (Order DRF-7CFFB3A52C)');

    const reversal = formatLedgerEntryDescription(
      'SALE_REVERSAL_DEBIT',
      orderReference,
    );
    expect(reversal).toBe('Sale payment reversal (Order DRF-7CFFB3A52C)');
  });
});

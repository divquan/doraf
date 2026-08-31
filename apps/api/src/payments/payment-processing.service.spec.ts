import type { PrismaService } from '../database/prisma.service';
import type { OutboxService } from '../operations/outbox.service';
import {
  PaymentProcessingService,
  type InitializedPaymentAttempt,
} from './payment-processing.service';
import type {
  PaymentGatewayService,
  ProviderPaymentResult,
} from './payment-gateway.service';
import type { OrderContactProtectionService } from '../orders/order-contact-protection.service';
import type { CheckoutAccessTokenService } from '../orders/checkout-access-token.service';
import type { VoucherRevealService } from '../recovery/voucher-reveal.service';

describe('PaymentProcessingService initialization recovery', () => {
  it('reclaims an unconfirmed initialization without creating a new attempt', async () => {
    const authorizationExpiresAt = new Date(Date.now() + 60 * 60_000);
    const attempt = {
      id: 'attempt-id',
      providerReference: 'payment-reference',
      state: 'RECONCILING',
      providerStatus: 'INITIATION_UNCONFIRMED',
      providerAccessCode: null,
      authorizationDisplayText: null,
      authorizationExpiresAt,
      syntheticEmailCiphertext: Buffer.from('encrypted-email'),
      expectedAmountMinor: 12_500n,
      currency: 'GHS',
      order: {},
    };
    const initialized: ProviderPaymentResult = {
      reference: attempt.providerReference,
      status: 'ongoing',
      amountMinor: attempt.expectedAmountMinor,
      currency: attempt.currency,
      transactionId: 'provider-transaction-id',
      accessCode: 'access-code',
      displayText: 'Authorize payment',
      message: null,
    };
    let recoveryClaimAccepted = false;
    const updateMany = jest.fn(
      (input: {
        where: {
          state?: unknown;
          OR?: Array<{ state?: unknown; providerStatus?: unknown }>;
        };
      }) => {
        if (input.where.OR) {
          recoveryClaimAccepted =
            input.where.state === undefined &&
            input.where.OR.some(
              (branch) =>
                branch.state === 'RECONCILING' &&
                branch.providerStatus === 'INITIATION_UNCONFIRMED',
            );
          return Promise.resolve({ count: recoveryClaimAccepted ? 1 : 0 });
        }
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany,
      },
    } as unknown as PrismaService;
    const contacts = {
      revealEmail: jest.fn().mockReturnValue('payer@example.com'),
    } as unknown as OrderContactProtectionService;
    const initialize = jest.fn().mockResolvedValue(initialized);
    const gateway = {
      initialize,
      mode: 'sandbox',
    } as unknown as PaymentGatewayService;

    const service = new PaymentProcessingService(
      prisma,
      contacts,
      {} as CheckoutAccessTokenService,
      {} as VoucherRevealService,
      gateway,
      {} as OutboxService,
    );

    const result = await service.initializePayment(
      attempt.providerReference,
      true,
    );

    expect(result).toEqual<InitializedPaymentAttempt>({
      reference: attempt.providerReference,
      state: 'PENDING_AUTHORIZATION',
      providerStatus: initialized.status,
      displayText: initialized.displayText,
      authorizationExpiresAt: authorizationExpiresAt.toISOString(),
      accessCode: 'access-code',
    });
    expect(initialize).toHaveBeenCalledWith({
      reference: attempt.providerReference,
      amountMinor: attempt.expectedAmountMinor,
      currency: attempt.currency,
      email: 'payer@example.com',
    });

    expect(recoveryClaimAccepted).toBe(true);
  });
});

/* eslint-disable @typescript-eslint/unbound-method */
import { PaystackWebhookController } from './paystack-webhook.controller';
import type { PaymentGatewayService } from '../payments/payment-gateway.service';
import type { PaymentProcessingService } from '../payments/payment-processing.service';
import type { WithdrawalsService } from '../wallet/withdrawals.service';

describe('PaystackWebhookController', () => {
  let gateway: jest.Mocked<PaymentGatewayService>;
  let payments: jest.Mocked<PaymentProcessingService>;
  let withdrawals: jest.Mocked<WithdrawalsService>;
  let controller: PaystackWebhookController;

  beforeEach(() => {
    gateway = {
      assertWebhookSignature: jest.fn(),
    } as unknown as jest.Mocked<PaymentGatewayService>;
    payments = {
      processPaystackWebhook: jest.fn(),
    } as unknown as jest.Mocked<PaymentProcessingService>;
    withdrawals = {
      reconcileReference: jest.fn(),
    } as unknown as jest.Mocked<WithdrawalsService>;
    controller = new PaystackWebhookController(gateway, payments, withdrawals);
  });

  it('routes a signed transfer event through provider reconciliation', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'transfer.success',
        data: { reference: 'dashchecker_wd_1234567890123456' },
      }),
    );

    await expect(
      controller.webhook({ rawBody } as never, 'signature'),
    ).resolves.toEqual({ accepted: true });

    expect(gateway.assertWebhookSignature).toHaveBeenCalledWith(
      rawBody,
      'signature',
    );
    expect(withdrawals.reconcileReference).toHaveBeenCalledWith(
      'dashchecker_wd_1234567890123456',
    );
    expect(payments.processPaystackWebhook).not.toHaveBeenCalled();
  });

  it('routes non-transfer events through existing payment processing', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: 'payment' },
      }),
    );
    payments.processPaystackWebhook.mockResolvedValue({ accepted: true });

    await controller.webhook({ rawBody } as never, 'signature');

    expect(payments.processPaystackWebhook).toHaveBeenCalledWith(
      rawBody,
      'signature',
    );
    expect(withdrawals.reconcileReference).not.toHaveBeenCalled();
  });
});

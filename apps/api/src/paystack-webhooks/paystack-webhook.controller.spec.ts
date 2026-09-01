import { PaystackWebhookController } from './paystack-webhook.controller';
import type { PaymentGatewayService } from '../payments/payment-gateway.service';
import type { PaymentProcessingService } from '../payments/payment-processing.service';
import type { WithdrawalsService } from '../wallet/withdrawals.service';

describe('PaystackWebhookController', () => {
  let gateway: { assertWebhookSignature: jest.Mock };
  let payments: {
    processPaystackWebhook: jest.Mock;
  };
  let withdrawals: { reconcileReference: jest.Mock };
  let controller: PaystackWebhookController;

  beforeEach(() => {
    gateway = { assertWebhookSignature: jest.fn() };
    payments = {
      processPaystackWebhook: jest.fn(),
    };
    withdrawals = {
      reconcileReference: jest.fn(),
    };
    controller = new PaystackWebhookController(
      gateway as unknown as PaymentGatewayService,
      payments as unknown as PaymentProcessingService,
      withdrawals as unknown as WithdrawalsService,
    );
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

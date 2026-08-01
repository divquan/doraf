import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { PaymentGatewayService } from './payment-gateway.service';

describe('PaymentGatewayService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses a no-network local adapter by default', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const gateway = new PaymentGatewayService(
      config({ PAYSTACK_MODE: 'local', PAYSTACK_SECRET_KEY: null }),
    );

    await expect(
      gateway.initialize({
        reference: 'DORAF-local-reference',
        amountMinor: 2_000n,
        currency: 'GHS',
        email: '233241234567@guest.localhost',
        phone: '233241234567',
        provider: 'mtn',
      }),
    ).resolves.toMatchObject({
      reference: 'DORAF-local-reference',
      status: 'pay_offline',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates Paystack signatures against the exact raw body', () => {
    const secret = 'sk_test_signature-secret';
    const gateway = new PaymentGatewayService(
      config({ PAYSTACK_MODE: 'sandbox', PAYSTACK_SECRET_KEY: secret }),
    );
    const body = Buffer.from('{"event":"charge.success","data":{}}');
    const signature = createHmac('sha512', secret).update(body).digest('hex');

    expect(() => gateway.assertWebhookSignature(body, signature)).not.toThrow();
    expect(() =>
      gateway.assertWebhookSignature(Buffer.from('{}'), signature),
    ).toThrow('Invalid Paystack signature');
  });

  it('sends Ghana Mobile Money charges from the server', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: 'Charge attempted',
          data: {
            reference: 'DORAF-sandbox-reference',
            status: 'pay_offline',
            display_text: 'Approve the prompt',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const gateway = new PaymentGatewayService(
      config({
        PAYSTACK_MODE: 'sandbox',
        PAYSTACK_SECRET_KEY: 'sk_test_gateway-secret',
      }),
    );

    await gateway.initialize({
      reference: 'DORAF-sandbox-reference',
      amountMinor: 2_000n,
      currency: 'GHS',
      email: '233241234567@guest.localhost',
      phone: '233241234567',
      provider: 'mtn',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.paystack.co/charge');
    const request = fetchSpy.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') {
      throw new Error('Expected the Paystack request body to be JSON');
    }
    expect(JSON.parse(request.body)).toEqual({
      email: '233241234567@guest.localhost',
      amount: '2000',
      currency: 'GHS',
      reference: 'DORAF-sandbox-reference',
      mobile_money: { phone: '+233241234567', provider: 'mtn' },
    });
  });
});

function config(values: Partial<AppEnvironment>) {
  return {
    get: jest.fn((key: keyof AppEnvironment) => values[key]),
  } as unknown as ConfigService<AppEnvironment, true>;
}

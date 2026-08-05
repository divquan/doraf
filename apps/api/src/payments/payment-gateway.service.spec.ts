import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import {
  PaymentGatewayService,
  PaymentProviderRequestException,
} from './payment-gateway.service';

describe('PaymentGatewayService', () => {
  afterEach(() => jest.restoreAllMocks());

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

  it('initializes a hosted Mobile Money checkout from the server', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            reference: 'DORAF-sandbox-reference',
            access_code: 'paystack-access-code',
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
      email: '233241234567@example.com',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://api.paystack.co/transaction/initialize',
    );
    const request = fetchSpy.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') {
      throw new Error('Expected the Paystack request body to be JSON');
    }
    expect(JSON.parse(request.body)).toEqual({
      email: '233241234567@example.com',
      amount: '2000',
      currency: 'GHS',
      reference: 'DORAF-sandbox-reference',
    });
  });

  it('classifies a Paystack validation response as a definite rejection', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: false,
          message: 'Invalid email address',
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );
    const gateway = new PaymentGatewayService(
      config({
        PAYSTACK_MODE: 'sandbox',
        PAYSTACK_SECRET_KEY: 'sk_test_gateway-secret',
      }),
    );

    await expect(
      gateway.initialize({
        reference: 'DORAF-sandbox-reference',
        amountMinor: 2_000n,
        currency: 'GHS',
        email: '233241234567@example.com',
      }),
    ).rejects.toMatchObject<Partial<PaymentProviderRequestException>>({
      kind: 'definitive',
      providerStatusCode: 400,
      providerMessage: 'Invalid email address',
    });
  });

  it('maps the registered Ghana phone and telco to a Paystack transfer recipient', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          data: { recipient_code: 'RCP_test_recipient' },
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

    await gateway.createMobileMoneyRecipient({
      name: 'Test Agent',
      phone: '+233241234567',
      network: 'TELECEL',
    });

    const request = fetchSpy.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string')
      throw new Error('Expected JSON body');
    expect(JSON.parse(request.body)).toEqual({
      type: 'mobile_money',
      name: 'Test Agent',
      account_number: '0241234567',
      bank_code: 'VOD',
      currency: 'GHS',
    });
  });

  it('submits a GHS transfer with a stable reference', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: 'doraf_wd_1234567890123456',
            transfer_code: 'TRF_test',
            status: 'pending',
            amount: 2_000,
            currency: 'GHS',
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

    await gateway.initiateTransfer({
      reference: 'doraf_wd_1234567890123456',
      recipientCode: 'RCP_test',
      amountMinor: 2_000n,
      reason: 'Doraf withdrawal',
    });

    const request = fetchSpy.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string')
      throw new Error('Expected JSON body');
    expect(JSON.parse(request.body)).toEqual({
      source: 'balance',
      amount: '2000',
      reference: 'doraf_wd_1234567890123456',
      recipient: 'RCP_test',
      reason: 'Doraf withdrawal',
      currency: 'GHS',
    });
  });

  it('resolves Mobile Money account name using Paystack bank/resolve endpoint', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: 'Account number resolved',
          data: {
            account_number: '0241234567',
            account_name: 'JOHN KOW KWOFIE',
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

    const result = await gateway.resolveAccount({
      accountNumber: '0241234567',
      network: 'MTN',
    });

    expect(result).toEqual({
      accountNumber: '0241234567',
      accountName: 'JOHN KOW KWOFIE',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.paystack.co/bank/resolve?account_number=0241234567&bank_code=MTN',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not release inventory for an unexpected charge-attempted response', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: false, message: 'Charge attempted' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );
    const gateway = new PaymentGatewayService(
      config({
        PAYSTACK_MODE: 'sandbox',
        PAYSTACK_SECRET_KEY: 'sk_test_gateway-secret',
      }),
    );

    await expect(
      gateway.initialize({
        reference: 'DORAF-sandbox-reference',
        amountMinor: 2_000n,
        currency: 'GHS',
        email: '233241234567@example.com',
      }),
    ).rejects.toMatchObject<Partial<PaymentProviderRequestException>>({
      kind: 'ambiguous',
      providerStatusCode: 400,
      providerMessage: 'Charge attempted',
    });
  });
});

function config(values: Partial<AppEnvironment>) {
  return {
    get: jest.fn((key: keyof AppEnvironment) => values[key]),
  } as unknown as ConfigService<AppEnvironment, true>;
}

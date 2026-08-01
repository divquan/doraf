import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  AppEnvironment,
  PaymentProviderMode,
} from '../config/environment';

export interface InitializeMobileMoneyPayment {
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  phone: string;
  provider: 'mtn' | 'atl' | 'vod';
}

export interface ProviderPaymentResult {
  reference: string;
  status: string;
  amountMinor: bigint | null;
  currency: string | null;
  transactionId: string | null;
  displayText: string | null;
  message: string | null;
}

@Injectable()
export class PaymentGatewayService {
  readonly mode: PaymentProviderMode;
  private readonly secretKey: string | null;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.mode = config.get('PAYSTACK_MODE', { infer: true });
    this.secretKey = config.get('PAYSTACK_SECRET_KEY', { infer: true });
  }

  async initialize(
    input: InitializeMobileMoneyPayment,
  ): Promise<ProviderPaymentResult> {
    if (this.mode === 'local') {
      return {
        reference: input.reference,
        status: 'pay_offline',
        amountMinor: input.amountMinor,
        currency: input.currency,
        transactionId: null,
        displayText:
          'Local development payment is ready. Complete it with the development control below.',
        message: 'Local payment initialized',
      };
    }

    const payload = await this.request('/charge', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor.toString(),
        currency: input.currency,
        reference: input.reference,
        mobile_money: {
          phone: `+${input.phone}`,
          provider: input.provider,
        },
      }),
    });
    return normalizeProviderResult(payload, input.reference);
  }

  async verify(reference: string): Promise<ProviderPaymentResult> {
    if (this.mode === 'local') {
      return {
        reference,
        status: 'pending',
        amountMinor: null,
        currency: null,
        transactionId: null,
        displayText: null,
        message: 'Local payment awaits explicit completion',
      };
    }
    const payload = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return normalizeProviderResult(payload, reference);
  }

  assertWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!this.secretKey || this.mode === 'local') {
      throw new UnauthorizedException('Paystack webhook is not configured');
    }
    if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }
    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest();
    const provided = Buffer.from(signature, 'hex');
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const secretKey = this.secretKey;
    if (!secretKey) {
      throw new BadGatewayException('Paystack is not configured');
    }
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('Paystack did not respond');
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.status !== true) {
      throw new BadGatewayException('Paystack rejected the request');
    }
    return payload;
  }
}

function normalizeProviderResult(
  payload: unknown,
  expectedReference: string,
): ProviderPaymentResult {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new BadGatewayException('Paystack returned an invalid response');
  }
  const data = payload.data;
  const reference = stringValue(data.reference);
  const status = stringValue(data.status);
  if (!reference || !status || reference !== expectedReference) {
    throw new BadGatewayException('Paystack returned an invalid transaction');
  }
  return {
    reference,
    status,
    amountMinor: integerValue(data.amount),
    currency: stringValue(data.currency)?.toUpperCase() ?? null,
    transactionId:
      stringValue(data.id) ?? stringValue(data.transaction_id) ?? null,
    displayText: stringValue(data.display_text),
    message:
      stringValue(data.message) ??
      stringValue(data.gateway_response) ??
      stringValue(payload.message),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function integerValue(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

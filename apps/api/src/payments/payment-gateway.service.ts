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

export type PaymentProviderFailureKind = 'definitive' | 'ambiguous';

export class PaymentProviderRequestException extends BadGatewayException {
  constructor(
    readonly kind: PaymentProviderFailureKind,
    readonly providerStatusCode: number | null,
    readonly providerMessage: string,
  ) {
    super(
      `Paystack request failed (${providerStatusCode ?? 'network'}: ${providerMessage})`,
    );
  }
}

export interface InitializeHostedCheckoutPayment {
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
}

export interface ProviderPaymentResult {
  reference: string;
  status: string;
  amountMinor: bigint | null;
  currency: string | null;
  transactionId: string | null;
  accessCode: string | null;
  displayText: string | null;
  message: string | null;
}

export interface ProviderRefundResult {
  reference: string;
  status: string;
}

export interface ProviderTransferRecipient {
  recipientCode: string;
}

export interface ProviderTransferResult {
  reference: string;
  transferCode: string | null;
  status: string;
  amountMinor: bigint | null;
  currency: string | null;
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
    input: InitializeHostedCheckoutPayment,
  ): Promise<ProviderPaymentResult> {
    const payload = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor.toString(),
        currency: input.currency,
        reference: input.reference,
      }),
    });
    return normalizeHostedCheckout(payload, input.reference);
  }

  async verify(reference: string): Promise<ProviderPaymentResult> {
    const payload = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return normalizeProviderResult(payload, reference);
  }

  async submitRefund(input: {
    transactionReference: string;
    amountMinor: bigint;
    currency: string;
  }): Promise<ProviderRefundResult> {
    const payload = await this.request('/refund', {
      method: 'POST',
      body: JSON.stringify({
        transaction: input.transactionReference,
        amount: input.amountMinor.toString(),
        currency: input.currency,
      }),
    });
    return normalizeRefundResult(payload);
  }

  async fetchRefund(reference: string): Promise<ProviderRefundResult> {
    const payload = await this.request(
      `/refund/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return normalizeRefundResult(payload);
  }

  async resolveAccount(input: {
    accountNumber: string;
    network: string;
  }): Promise<{ accountNumber: string; accountName: string }> {
    const localPhone = toGhanaLocalPhone(input.accountNumber);
    const bankCode = paystackMobileMoneyCode(input.network);
    const payload = await this.request(
      `/bank/resolve?account_number=${encodeURIComponent(localPhone)}&bank_code=${encodeURIComponent(bankCode)}`,
      { method: 'GET' },
    );
    if (!isRecord(payload) || !isRecord(payload.data)) {
      throw new BadGatewayException(
        'Paystack returned an invalid account resolution',
      );
    }
    const accountNumber = stringValue(payload.data.account_number);
    const accountName = stringValue(payload.data.account_name);
    if (!accountNumber || !accountName) {
      throw new BadGatewayException(
        'Could not resolve Mobile Money account name',
      );
    }
    return { accountNumber, accountName };
  }

  async createMobileMoneyRecipient(input: {
    name: string;
    phone: string;
    network: string;
  }): Promise<ProviderTransferRecipient> {
    const payload = await this.request('/transferrecipient', {
      method: 'POST',
      body: JSON.stringify({
        type: 'mobile_money',
        name: input.name,
        account_number: toGhanaLocalPhone(input.phone),
        bank_code: paystackMobileMoneyCode(input.network),
        currency: 'GHS',
      }),
    });
    if (!isRecord(payload) || !isRecord(payload.data)) {
      throw new BadGatewayException('Paystack returned an invalid recipient');
    }
    const recipientCode = stringValue(payload.data.recipient_code);
    if (!recipientCode) {
      throw new BadGatewayException('Paystack returned an invalid recipient');
    }
    return { recipientCode };
  }

  async initiateTransfer(input: {
    reference: string;
    recipientCode: string;
    amountMinor: bigint;
    reason: string;
  }): Promise<ProviderTransferResult> {
    const payload = await this.request('/transfer', {
      method: 'POST',
      body: JSON.stringify({
        source: 'balance',
        amount: input.amountMinor.toString(),
        reference: input.reference,
        recipient: input.recipientCode,
        reason: input.reason,
        currency: 'GHS',
      }),
    });
    return normalizeTransferResult(payload, input.reference);
  }

  async verifyTransfer(reference: string): Promise<ProviderTransferResult> {
    const payload = await this.request(
      `/transfer/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return normalizeTransferResult(payload, reference);
  }

  async finalizeTransfer(input: {
    transferCode: string;
    otp: string;
    reference: string;
  }): Promise<ProviderTransferResult> {
    const payload = await this.request('/transfer/finalize_transfer', {
      method: 'POST',
      body: JSON.stringify({
        transfer_code: input.transferCode,
        otp: input.otp,
      }),
    });
    return normalizeTransferResult(payload, input.reference);
  }

  assertWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!this.secretKey) {
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
    } catch (error) {
      if (error instanceof PaymentProviderRequestException) throw error;
      throw new PaymentProviderRequestException(
        'ambiguous',
        null,
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Request timed out'
          : 'Paystack did not respond',
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (isRecord(payload) && payload.status === true) {
      return payload;
    }
    if (!response.ok || !isRecord(payload) || payload.status !== true) {
      const providerMessage = providerResponseMessage(payload);
      throw new PaymentProviderRequestException(
        isDefinitiveProviderResponse(response.status) &&
          !isChargeAttempted(providerMessage)
          ? 'definitive'
          : 'ambiguous',
        response.status,
        providerMessage,
      );
    }
    return payload;
  }
}

function isDefinitiveProviderResponse(statusCode: number): boolean {
  return (
    statusCode >= 400 &&
    statusCode < 500 &&
    statusCode !== 408 &&
    statusCode !== 429
  );
}

function providerResponseMessage(payload: unknown): string {
  if (!isRecord(payload)) return 'Paystack returned no structured error';
  return stringValue(payload.message) ?? 'Paystack rejected the request';
}

function isChargeAttempted(message: string): boolean {
  return message.trim().toLowerCase() === 'charge attempted';
}

function paystackMobileMoneyCode(network: string): string {
  switch (network) {
    case 'MTN':
      return 'MTN';
    case 'TELECEL':
      return 'VOD';
    case 'AIRTELTIGO':
      return 'ATL';
    default:
      throw new BadGatewayException('Unsupported Mobile Money network');
  }
}

function toGhanaLocalPhone(phone: string): string {
  const local = phone.replace(/^\+?233/, '0');
  if (!/^0\d{9}$/.test(local)) {
    throw new BadGatewayException('Registered Mobile Money number is invalid');
  }
  return local;
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
    accessCode: null,
    displayText: stringValue(data.display_text),
    message:
      stringValue(data.message) ??
      stringValue(data.gateway_response) ??
      stringValue(payload.message),
  };
}

function normalizeHostedCheckout(
  payload: unknown,
  expectedReference: string,
): ProviderPaymentResult {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new BadGatewayException('Paystack returned an invalid response');
  }
  const data = payload.data;
  const reference = stringValue(data.reference);
  const accessCode = stringValue(data.access_code);
  if (!reference || !accessCode || reference !== expectedReference) {
    throw new BadGatewayException('Paystack returned an invalid checkout');
  }
  return {
    reference,
    status: 'initialized',
    amountMinor: null,
    currency: null,
    transactionId: null,
    accessCode,
    displayText: 'Continue securely in the Paystack checkout window.',
    message: stringValue(payload.message),
  };
}

function normalizeRefundResult(payload: unknown): ProviderRefundResult {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new BadGatewayException('Paystack returned an invalid refund');
  }
  const reference = stringValue(payload.data.id);
  const status = stringValue(payload.data.status)?.toLowerCase();
  if (!reference || !status) {
    throw new BadGatewayException('Paystack returned an invalid refund');
  }
  return { reference, status };
}

function normalizeTransferResult(
  payload: unknown,
  expectedReference: string,
): ProviderTransferResult {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new BadGatewayException('Paystack returned an invalid transfer');
  }
  const reference = stringValue(payload.data.reference);
  const status = stringValue(payload.data.status)?.toLowerCase();
  if (!reference || !status || reference !== expectedReference) {
    throw new BadGatewayException('Paystack returned an invalid transfer');
  }
  return {
    reference,
    status,
    transferCode: stringValue(payload.data.transfer_code),
    amountMinor: integerValue(payload.data.amount),
    currency: stringValue(payload.data.currency)?.toUpperCase() ?? null,
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

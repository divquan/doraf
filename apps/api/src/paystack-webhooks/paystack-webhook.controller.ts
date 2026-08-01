import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { PaymentGatewayService } from '../payments/payment-gateway.service';
import { PaymentProcessingService } from '../payments/payment-processing.service';
import { WithdrawalsService } from '../wallet/withdrawals.service';

const TRANSFER_EVENTS = new Set([
  'transfer.success',
  'transfer.failed',
  'transfer.reversed',
]);

@Controller()
@UseInterceptors(NoStoreInterceptor)
export class PaystackWebhookController {
  constructor(
    private readonly gateway: PaymentGatewayService,
    private readonly payments: PaymentProcessingService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  @Post('payments/paystack/webhook')
  @HttpCode(200)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw request body is unavailable');
    }
    const event = parseEvent(request.rawBody);
    if (!TRANSFER_EVENTS.has(event.type)) {
      return this.payments.processPaystackWebhook(request.rawBody, signature);
    }

    this.gateway.assertWebhookSignature(request.rawBody, signature);
    if (!event.reference) {
      throw new BadRequestException('Transfer reference is required');
    }
    await this.withdrawals.reconcileReference(event.reference);
    return { accepted: true };
  }
}

function parseEvent(rawBody: Buffer): {
  type: string;
  reference: string | null;
} {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    throw new BadRequestException('Webhook body is invalid');
  }
  if (!isRecord(payload))
    throw new BadRequestException('Webhook body is invalid');
  const data = isRecord(payload.data) ? payload.data : null;
  return {
    type: typeof payload.event === 'string' ? payload.event : '',
    reference:
      data && typeof data.reference === 'string' ? data.reference : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

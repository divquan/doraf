import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { PaymentProcessingService } from './payment-processing.service';

@Controller()
@UseInterceptors(NoStoreInterceptor)
export class PaymentsController {
  constructor(private readonly payments: PaymentProcessingService) {}

  @Post('payments/paystack/webhook')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!request.rawBody) throw new Error('Raw request body is unavailable');
    return this.payments.processPaystackWebhook(request.rawBody, signature);
  }

  @Get('sales-channels/web/:webSalesId/orders/:orderReference')
  @UseGuards(ThrottlerGuard)
  @Throttle({ checkout: { limit: 30, ttl: 60_000 } })
  status(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
  ) {
    return this.payments.getPublicOrderStatus(webSalesId, orderReference);
  }

  @Post('sales-channels/web/:webSalesId/orders/:orderReference/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  verify(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
  ) {
    return this.payments.verifyPublicPayment(webSalesId, orderReference);
  }
}

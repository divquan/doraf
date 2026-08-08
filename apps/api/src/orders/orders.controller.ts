import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { CreateWebOrderRequest } from './dto/create-web-order.request';
import { OrdersService } from './orders.service';
import { PaymentProcessingService } from '../payments/payment-processing.service';

@Controller('sales-channels/web/:webSalesId/orders')
@UseGuards(ThrottlerGuard)
@UseInterceptors(NoStoreInterceptor)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentProcessingService,
  ) {}

  @Post()
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  async create(
    @Param('webSalesId') webSalesId: string,
    @Body() request: CreateWebOrderRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const order = await this.orders.createWebOrder({
      webSalesId,
      ...request,
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
    try {
      const payment = await this.payments.initializePayment(
        order.payment.reference,
      );
      return { ...order, payment };
    } catch (error) {
      return initializationFailureResponse(order, error);
    }
  }

  @Post(':orderReference/retry')
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  async retry(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-checkout-token') checkoutAccessToken?: string,
  ) {
    const order = await this.orders.retryWebOrder({
      webSalesId,
      orderReference,
      checkoutAccessToken,
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
    try {
      const payment = await this.payments.initializePayment(
        order.payment.reference,
      );
      return { ...order, payment };
    } catch (error) {
      return initializationFailureResponse(order, error);
    }
  }
}

function initializationFailureResponse(
  order: {
    payment: {
      reference: string;
      state: string;
      authorizationExpiresAt: string;
    };
  },
  error: unknown,
) {
  if (
    !(error instanceof ConflictException) &&
    !(error instanceof UnprocessableEntityException)
  ) {
    throw error;
  }
  return {
    ...order,
    payment: {
      ...order.payment,
      state: error instanceof ConflictException ? 'RECONCILING' : 'FAILED',
      providerStatus: null,
      displayText: error.message,
    },
  };
}

function requiredIdempotencyKey(value?: string): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key must contain 8 to 200 safe characters',
    );
  }
  return value;
}

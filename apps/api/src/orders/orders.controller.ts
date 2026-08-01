import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { CreateWebOrderRequest } from './dto/create-web-order.request';
import { OrdersService } from './orders.service';

@Controller('sales-channels/web/:webSalesId/orders')
@UseGuards(ThrottlerGuard)
@UseInterceptors(NoStoreInterceptor)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  create(
    @Param('webSalesId') webSalesId: string,
    @Body() request: CreateWebOrderRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.createWebOrder({
      webSalesId,
      ...request,
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
  }
}

function requiredIdempotencyKey(value?: string): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key must contain 8 to 200 safe characters',
    );
  }
  return value;
}

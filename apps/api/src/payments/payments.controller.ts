import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { PaymentProcessingService } from './payment-processing.service';

@Controller()
@UseInterceptors(NoStoreInterceptor)
export class PaymentsController {
  constructor(private readonly payments: PaymentProcessingService) {}

  @Get('sales-channels/web/:webSalesId/orders/:orderReference')
  @UseGuards(ThrottlerGuard)
  @Throttle({ checkout: { limit: 30, ttl: 60_000 } })
  status(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
    @Headers('x-checkout-token') checkoutAccessToken?: string,
  ) {
    return this.payments.getPublicOrderStatus(
      webSalesId,
      orderReference,
      checkoutAccessToken,
    );
  }

  @Post('sales-channels/web/:webSalesId/orders/:orderReference/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  verify(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
    @Headers('x-checkout-token') checkoutAccessToken?: string,
    @Headers('x-payment-reference') paymentReference?: string,
  ) {
    return this.payments.verifyPublicPayment(
      webSalesId,
      orderReference,
      paymentReference,
      checkoutAccessToken,
    );
  }

  @Post('sales-channels/web/:webSalesId/orders/:orderReference/reveal')
  @UseGuards(ThrottlerGuard)
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  reveal(
    @Param('webSalesId') webSalesId: string,
    @Param('orderReference') orderReference: string,
    @Headers('x-checkout-token') checkoutAccessToken?: string,
  ) {
    return this.payments.revealPublicOrder(
      webSalesId,
      orderReference,
      checkoutAccessToken,
    );
  }
}

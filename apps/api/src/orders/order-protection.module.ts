import { Module } from '@nestjs/common';
import { CheckoutAccessTokenService } from './checkout-access-token.service';
import { OrderContactProtectionService } from './order-contact-protection.service';

@Module({
  providers: [CheckoutAccessTokenService, OrderContactProtectionService],
  exports: [CheckoutAccessTokenService, OrderContactProtectionService],
})
export class OrderProtectionModule {}

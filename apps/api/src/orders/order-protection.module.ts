import { Module } from '@nestjs/common';
import { OrderContactProtectionService } from './order-contact-protection.service';

@Module({
  providers: [OrderContactProtectionService],
  exports: [OrderContactProtectionService],
})
export class OrderProtectionModule {}

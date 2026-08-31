import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { PricingHandlersModule } from './pricing-handlers.module';

@Module({
  imports: [InternalAccessModule, PricingHandlersModule],
  controllers: [PricingController],
  exports: [PricingHandlersModule],
})
export class PricingModule {}

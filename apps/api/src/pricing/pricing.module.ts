import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { OperationsModule } from '../operations/operations.module';
import { PricingService } from './pricing.service';
import { PricingOutboxHandler } from './pricing-outbox.handler';
import { InternalAccessModule } from '../internal-access/internal-access.module';

@Module({
  imports: [InternalAccessModule, OperationsModule],
  controllers: [PricingController],
  providers: [PricingService, PricingOutboxHandler],
  exports: [PricingService, PricingOutboxHandler],
})
export class PricingModule {}

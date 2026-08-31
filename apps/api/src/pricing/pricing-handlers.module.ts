import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OperationsModule } from '../operations/operations.module';
import { PricingService } from './pricing.service';
import { PricingOutboxHandler } from './pricing-outbox.handler';

@Module({
  imports: [DatabaseModule, OperationsModule],
  providers: [PricingService, PricingOutboxHandler],
  exports: [PricingService, PricingOutboxHandler],
})
export class PricingHandlersModule {}

import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { OperationsModule } from '../operations/operations.module';
import { PricingService } from './pricing.service';

@Module({
  imports: [OperationsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}

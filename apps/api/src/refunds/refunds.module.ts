import { Module } from '@nestjs/common';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { OperationsModule } from '../operations/operations.module';
import { RefundsHandlersModule } from './refunds-handlers.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [InternalAccessModule, OperationsModule, RefundsHandlersModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsHandlersModule],
})
export class RefundsModule {}

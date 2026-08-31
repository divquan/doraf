import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OperationsModule } from '../operations/operations.module';
import { PaymentsGatewayModule } from '../payments/payments-gateway.module';
import { RefundOutboxHandler } from './refund-outbox.handler';

@Module({
  imports: [DatabaseModule, OperationsModule, PaymentsGatewayModule],
  providers: [RefundOutboxHandler],
  exports: [RefundOutboxHandler],
})
export class RefundsHandlersModule {}

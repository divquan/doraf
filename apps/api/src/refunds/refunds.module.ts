import { Module } from '@nestjs/common';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { OperationsModule } from '../operations/operations.module';
import { PaymentsModule } from '../payments/payments.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundOutboxHandler } from './refund-outbox.handler';
import { RefundOutboxWorker } from './refund-outbox.worker';
import { RefundReconciliationWorker } from './refund-reconciliation.worker';

@Module({
  imports: [InternalAccessModule, OperationsModule, PaymentsModule],
  controllers: [RefundsController],
  providers: [
    RefundsService,
    RefundOutboxHandler,
    RefundOutboxWorker,
    RefundReconciliationWorker,
  ],
})
export class RefundsModule {}

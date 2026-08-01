import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentReconciliationWorker } from './payment-reconciliation.worker';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [OperationsModule, OrderProtectionModule],
  controllers: [PaymentsController],
  providers: [
    PaymentGatewayService,
    PaymentProcessingService,
    PaymentReconciliationWorker,
  ],
  exports: [PaymentProcessingService],
})
export class PaymentsModule {}

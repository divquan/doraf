import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { VoucherProtectionModule } from '../recovery/voucher-protection.module';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentInitializationWorker } from './payment-initialization.worker';
import { PaymentReconciliationWorker } from './payment-reconciliation.worker';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [OperationsModule, OrderProtectionModule, VoucherProtectionModule],
  controllers: [PaymentsController],
  providers: [
    PaymentGatewayService,
    PaymentProcessingService,
    PaymentInitializationWorker,
    PaymentReconciliationWorker,
  ],
  exports: [PaymentGatewayService, PaymentProcessingService],
})
export class PaymentsModule {}

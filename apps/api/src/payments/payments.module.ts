import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { VoucherProtectionModule } from '../recovery/voucher-protection.module';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [OperationsModule, OrderProtectionModule, VoucherProtectionModule],
  controllers: [PaymentsController],
  providers: [PaymentGatewayService, PaymentProcessingService],
  exports: [PaymentGatewayService, PaymentProcessingService],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { VoucherProtectionModule } from '../recovery/voucher-protection.module';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGatewayModule } from './payments-gateway.module';

@Module({
  imports: [
    OperationsModule,
    OrderProtectionModule,
    VoucherProtectionModule,
    PaymentsGatewayModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentProcessingService],
  exports: [PaymentsGatewayModule, PaymentProcessingService],
})
export class PaymentsModule {}

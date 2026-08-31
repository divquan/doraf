import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { DevelopmentDeliveryGateway } from './delivery-gateway.service';
import { DeliveryOutboxHandler } from './delivery-outbox.handler';

@Module({
  imports: [OperationsModule, OrderProtectionModule],
  providers: [DevelopmentDeliveryGateway, DeliveryOutboxHandler],
  exports: [DeliveryOutboxHandler],
})
export class DeliveryModule {}

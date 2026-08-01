import { Module } from '@nestjs/common';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { DevelopmentDeliveryGateway } from './delivery-gateway.service';
import { DeliveryOutboxHandler } from './delivery-outbox.handler';
import { DeliveryOutboxWorker } from './delivery-outbox.worker';

@Module({
  imports: [OperationsModule, OrderProtectionModule],
  providers: [
    DevelopmentDeliveryGateway,
    DeliveryOutboxHandler,
    DeliveryOutboxWorker,
  ],
  exports: [DeliveryOutboxHandler],
})
export class DeliveryModule {}

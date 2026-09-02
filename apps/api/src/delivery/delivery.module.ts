import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { OperationsModule } from '../operations/operations.module';
import { VoucherProtectionModule } from '../recovery/voucher-protection.module';
import {
  DELIVERY_GATEWAY,
  DevelopmentDeliveryGateway,
} from './delivery-gateway.service';
import { DeliveryOutboxHandler } from './delivery-outbox.handler';
import { ProductionDeliveryGateway } from './production-delivery.gateway';

@Module({
  imports: [OperationsModule, OrderProtectionModule, VoucherProtectionModule],
  providers: [
    DevelopmentDeliveryGateway,
    ProductionDeliveryGateway,
    {
      provide: DELIVERY_GATEWAY,
      useFactory: (
        config: ConfigService<AppEnvironment, true>,
        devGateway: DevelopmentDeliveryGateway,
        prodGateway: ProductionDeliveryGateway,
      ) => {
        const hasHubtel = Boolean(
          config.get('HUBTEL_CLIENT_ID', { infer: true }),
        );
        const hasLoops = Boolean(config.get('LOOPS_API_KEY', { infer: true }));
        if (
          config.get('NODE_ENV', { infer: true }) === 'production' &&
          (hasHubtel || hasLoops)
        ) {
          return prodGateway;
        }
        return devGateway;
      },
      inject: [
        ConfigService,
        DevelopmentDeliveryGateway,
        ProductionDeliveryGateway,
      ],
    },
    DeliveryOutboxHandler,
  ],
  exports: [DeliveryOutboxHandler, DELIVERY_GATEWAY],
})
export class DeliveryModule {}

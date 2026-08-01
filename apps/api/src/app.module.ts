import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './catalog/catalog.module';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { AgentAccessModule } from './agent-access/agent-access.module';
import { OperationsModule } from './operations/operations.module';
import { PricingModule } from './pricing/pricing.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    CatalogModule,
    AgentAccessModule,
    OperationsModule,
    PricingModule,
    InventoryModule.registerMasterKey(),
    OrdersModule,
    DeliveryModule,
  ],
})
export class AppModule {}

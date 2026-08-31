import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { OperationsModule } from '../operations/operations.module';
import { PricingHandlersModule } from '../pricing/pricing-handlers.module';
import { RefundsHandlersModule } from '../refunds/refunds-handlers.module';
import { WalletHandlersModule } from '../wallet/wallet-handlers.module';
import { CloudTasksOidcVerifier } from '../operations/cloud-tasks-oidc.verifier';
import { OutboxTaskRouter } from '../operations/outbox-task.router';
import { OutboxTaskController } from '../operations/outbox-task.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    OperationsModule,
    PricingHandlersModule,
    RefundsHandlersModule,
    WalletHandlersModule,
    DeliveryModule,
  ],
  controllers: [OutboxTaskController],
  providers: [CloudTasksOidcVerifier, OutboxTaskRouter],
})
export class TaskConsumerModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { OperationsModule } from '../operations/operations.module';
import { PricingModule } from '../pricing/pricing.module';
import { RefundsModule } from '../refunds/refunds.module';
import { WalletModule } from '../wallet/wallet.module';
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
    PricingModule,
    RefundsModule,
    WalletModule,
    DeliveryModule,
  ],
  controllers: [OutboxTaskController],
  providers: [CloudTasksOidcVerifier, OutboxTaskRouter],
})
export class TaskConsumerModule {}

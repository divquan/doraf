import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { DeliveryOutboxWorker } from './delivery/delivery-outbox.worker';
import { DeliveryModule } from './delivery/delivery.module';
import { GeneralOutboxWorker } from './operations/general-outbox.worker';
import { OutboxLeaseRecoveryWorker } from './operations/outbox-lease-recovery.worker';
import { OperationsModule } from './operations/operations.module';
import { RedisOutboxConsumer } from './operations/redis-outbox.consumer';
import { RedisOutboxDispatcher } from './operations/redis-outbox.dispatcher';
import { RedisOutboxQueue } from './operations/redis-outbox.queue';
import { PaymentInitializationWorker } from './payments/payment-initialization.worker';
import { PaymentReconciliationWorker } from './payments/payment-reconciliation.worker';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { PricingOutboxWorker } from './pricing/pricing-outbox.worker';
import { RefundOutboxWorker } from './refunds/refund-outbox.worker';
import { RefundReconciliationWorker } from './refunds/refund-reconciliation.worker';
import { RefundsModule } from './refunds/refunds.module';
import { ReportingModule } from './reporting/reporting.module';
import { InvariantReconciliationWorker } from './reporting/invariant-reconciliation.worker';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalOutboxWorker } from './wallet/withdrawal-outbox.worker';
import { WithdrawalReconciliationWorker } from './wallet/withdrawal-reconciliation.worker';

/**
 * Worker-only composition root. AppModule intentionally contains no worker
 * providers, so the HTTP process cannot start polling timers accidentally.
 * Import the domain modules that provide the handlers/services workers depend on.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    OperationsModule,
    PaymentsModule,
    PricingModule,
    RefundsModule,
    WalletModule,
    DeliveryModule,
    ReportingModule,
  ],
  providers: [
    GeneralOutboxWorker,
    OutboxLeaseRecoveryWorker,
    PaymentInitializationWorker,
    PaymentReconciliationWorker,
    PricingOutboxWorker,
    RefundOutboxWorker,
    RefundReconciliationWorker,
    WithdrawalOutboxWorker,
    WithdrawalReconciliationWorker,
    InvariantReconciliationWorker,
    DeliveryOutboxWorker,
    RedisOutboxQueue,
    RedisOutboxDispatcher,
    RedisOutboxConsumer,
  ],
})
export class WorkerAppModule {}

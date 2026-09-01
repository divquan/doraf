import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { DeliveryModule } from './delivery/delivery.module';
import { OutboxLeaseRecoveryWorker } from './operations/outbox-lease-recovery.worker';
import { OperationsModule } from './operations/operations.module';
import { PaymentInitializationWorker } from './payments/payment-initialization.worker';
import { PaymentReconciliationWorker } from './payments/payment-reconciliation.worker';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { RefundReconciliationWorker } from './refunds/refund-reconciliation.worker';
import { RefundsModule } from './refunds/refunds.module';
import { ReportingModule } from './reporting/reporting.module';
import { InvariantReconciliationWorker } from './reporting/invariant-reconciliation.worker';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalReconciliationWorker } from './wallet/withdrawal-reconciliation.worker';

/** Bounded Cloud Run Job composition root; no polling workers are registered. */
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
    OutboxLeaseRecoveryWorker,
    PaymentInitializationWorker,
    PaymentReconciliationWorker,
    RefundReconciliationWorker,
    WithdrawalReconciliationWorker,
    InvariantReconciliationWorker,
  ],
})
export class WorkerAppModule {}

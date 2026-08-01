import { Module } from '@nestjs/common';
import { AgentAccessModule } from '../agent-access/agent-access.module';
import { PaymentsModule } from '../payments/payments.module';
import { OperationsModule } from '../operations/operations.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WithdrawalOutboxHandler } from './withdrawal-outbox.handler';
import { WithdrawalOutboxWorker } from './withdrawal-outbox.worker';
import { WithdrawalReconciliationWorker } from './withdrawal-reconciliation.worker';

@Module({
  imports: [AgentAccessModule, OperationsModule, PaymentsModule],
  controllers: [WalletController, WithdrawalsAdminController],
  providers: [
    WalletService,
    WithdrawalsService,
    WithdrawalOutboxHandler,
    WithdrawalOutboxWorker,
    WithdrawalReconciliationWorker,
  ],
  exports: [WalletService, WithdrawalsService],
})
export class WalletModule {}

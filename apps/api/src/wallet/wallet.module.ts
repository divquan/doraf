import { Module } from '@nestjs/common';
import { AgentAccessModule } from '../agent-access/agent-access.module';
import { PaymentsModule } from '../payments/payments.module';
import { OperationsModule } from '../operations/operations.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WithdrawalOutboxHandler } from './withdrawal-outbox.handler';

@Module({
  imports: [AgentAccessModule, OperationsModule, PaymentsModule],
  controllers: [WalletController, WithdrawalsAdminController],
  providers: [WalletService, WithdrawalsService, WithdrawalOutboxHandler],
  exports: [WalletService, WithdrawalsService, WithdrawalOutboxHandler],
})
export class WalletModule {}

import { Module } from '@nestjs/common';
import { AgentAccessModule } from '../agent-access/agent-access.module';
import { OperationsModule } from '../operations/operations.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WalletHandlersModule } from './wallet-handlers.module';

@Module({
  imports: [AgentAccessModule, OperationsModule, WalletHandlersModule],
  controllers: [WalletController, WithdrawalsAdminController],
  providers: [WalletService],
  exports: [WalletService, WalletHandlersModule],
})
export class WalletModule {}

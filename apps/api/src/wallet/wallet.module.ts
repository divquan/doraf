import { Module } from '@nestjs/common';
import { AgentAccessModule } from '../agent-access/agent-access.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [AgentAccessModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

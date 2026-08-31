import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OperationsModule } from '../operations/operations.module';
import { AgentCryptoModule } from '../agent-access/agent-crypto.module';
import { PaymentsGatewayModule } from '../payments/payments-gateway.module';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalOutboxHandler } from './withdrawal-outbox.handler';

@Module({
  imports: [
    DatabaseModule,
    OperationsModule,
    AgentCryptoModule,
    PaymentsGatewayModule,
  ],
  providers: [WithdrawalsService, WithdrawalOutboxHandler],
  exports: [WithdrawalsService, WithdrawalOutboxHandler],
})
export class WalletHandlersModule {}

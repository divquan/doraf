import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentAccessModule } from '../agent-access/agent-access.module';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { OrderProtectionModule } from '../orders/order-protection.module';
import { BuyerRecoveryController } from './buyer-recovery.controller';
import { BuyerRecoveryService } from './buyer-recovery.service';
import { BuyerRecoveryTokenService } from './buyer-recovery-token.service';
import { VoucherProtectionModule } from './voucher-protection.module';

@Module({
  imports: [
    AgentAccessModule,
    InternalAccessModule,
    OrderProtectionModule,
    VoucherProtectionModule,
    ThrottlerModule.forRoot([{ name: 'recovery', ttl: 60_000, limit: 10 }]),
  ],
  controllers: [BuyerRecoveryController],
  providers: [BuyerRecoveryService, BuyerRecoveryTokenService],
  exports: [VoucherProtectionModule],
})
export class RecoveryModule {}

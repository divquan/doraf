import { Module } from '@nestjs/common';
import { VoucherRevealService } from './voucher-reveal.service';

@Module({
  providers: [VoucherRevealService],
  exports: [VoucherRevealService],
})
export class VoucherProtectionModule {}

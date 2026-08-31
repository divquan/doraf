import { Module } from '@nestjs/common';
import { OtpTokenService } from './otp-token.service';
import { PhoneProtectionService } from './phone-protection.service';

@Module({
  providers: [OtpTokenService, PhoneProtectionService],
  exports: [OtpTokenService, PhoneProtectionService],
})
export class AgentCryptoModule {}

import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentAuthService } from './agent-auth.service';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { AgentSessionGuard } from './agent-session.guard';
import { LocalSmsOtpSender } from './local-sms-otp.sender';
import { OtpTokenService } from './otp-token.service';
import { PhoneProtectionService } from './phone-protection.service';
import { SMS_OTP_SENDER } from './agent-access.types';
import { InternalAccessModule } from '../internal-access/internal-access.module';

@Module({
  imports: [InternalAccessModule],
  controllers: [AgentAuthController],
  providers: [
    AgentAuthService,
    AgentSessionGuard,
    AgentNoStoreInterceptor,
    PhoneProtectionService,
    OtpTokenService,
    LocalSmsOtpSender,
    { provide: SMS_OTP_SENDER, useExisting: LocalSmsOtpSender },
  ],
})
export class AgentAccessModule {}

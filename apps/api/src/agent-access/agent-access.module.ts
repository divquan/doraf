import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentAdministrationController } from './agent-administration.controller';
import { AgentAdministrationService } from './agent-administration.service';
import { AgentAuthService } from './agent-auth.service';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { AgentSessionGuard } from './agent-session.guard';
import { LocalSmsOtpSender } from './local-sms-otp.sender';
import { OtpTokenService } from './otp-token.service';
import { PhoneProtectionService } from './phone-protection.service';
import { SMS_OTP_SENDER } from './agent-access.types';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { PricingModule } from '../pricing/pricing.module';
import { SalesChannelController } from './sales-channel.controller';
import { SalesChannelService } from './sales-channel.service';

@Module({
  imports: [InternalAccessModule, PricingModule],
  controllers: [
    AgentAuthController,
    AgentAdministrationController,
    SalesChannelController,
  ],
  providers: [
    AgentAuthService,
    AgentAdministrationService,
    AgentSessionGuard,
    AgentNoStoreInterceptor,
    PhoneProtectionService,
    OtpTokenService,
    SalesChannelService,
    LocalSmsOtpSender,
    { provide: SMS_OTP_SENDER, useExisting: LocalSmsOtpSender },
  ],
  exports: [OtpTokenService, SMS_OTP_SENDER],
})
export class AgentAccessModule {}

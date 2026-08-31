import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentAdministrationController } from './agent-administration.controller';
import { AgentAdministrationService } from './agent-administration.service';
import { AgentAuthService } from './agent-auth.service';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { AgentSessionGuard } from './agent-session.guard';
import { LocalSmsOtpSender } from './local-sms-otp.sender';
import { SMS_OTP_SENDER } from './agent-access.types';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersModule } from '../orders/orders.module';
import { SalesChannelController } from './sales-channel.controller';
import { SalesChannelService } from './sales-channel.service';
import { AgentOnboardingService } from './agent-onboarding.service';
import { AgentCryptoModule } from './agent-crypto.module';

@Module({
  imports: [
    InternalAccessModule,
    PricingModule,
    OrdersModule,
    AgentCryptoModule,
  ],
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
    SalesChannelService,
    AgentOnboardingService,
    LocalSmsOtpSender,
    { provide: SMS_OTP_SENDER, useExisting: LocalSmsOtpSender },
  ],
  exports: [
    AgentSessionGuard,
    AgentNoStoreInterceptor,
    SMS_OTP_SENDER,
    InternalAccessModule,
    AgentCryptoModule,
  ],
})
export class AgentAccessModule {}

import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentAdministrationController } from './agent-administration.controller';
import { AgentAdministrationService } from './agent-administration.service';
import { AgentAuthService } from './agent-auth.service';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { AgentSessionGuard } from './agent-session.guard';
import { LocalSmsOtpSender } from './local-sms-otp.sender';
import { HubtelSmsOtpSender } from './hubtel-sms-otp.sender';
import { SMS_OTP_SENDER } from './agent-access.types';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersModule } from '../orders/orders.module';
import { SalesChannelController } from './sales-channel.controller';
import { SalesChannelService } from './sales-channel.service';
import { AgentOnboardingService } from './agent-onboarding.service';
import { AgentCryptoModule } from './agent-crypto.module';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';

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
    HubtelSmsOtpSender,
    {
      provide: SMS_OTP_SENDER,
      useFactory: (
        config: ConfigService<AppEnvironment, true>,
        local: LocalSmsOtpSender,
        hubtel: HubtelSmsOtpSender,
      ) => {
        if (
          config.get('NODE_ENV', { infer: true }) === 'production' &&
          config.get('HUBTEL_CLIENT_ID', { infer: true })
        ) {
          return hubtel;
        }
        return local;
      },
      inject: [ConfigService, LocalSmsOtpSender, HubtelSmsOtpSender],
    },
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

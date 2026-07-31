import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentInternalPrincipal } from './current-internal-principal.decorator';
import { PasskeyAuthenticationVerifyRequest } from './dto/passkey-authentication-verify.request';
import { PasskeyRegistrationOptionsRequest } from './dto/passkey-registration-options.request';
import { PasskeyRegistrationVerifyRequest } from './dto/passkey-registration-verify.request';
import type { InternalPrincipal } from './internal-access.types';
import { InternalSessionGuard } from './internal-session.guard';
import { PasskeyAuthService } from './passkey-auth.service';
import { NoStoreInterceptor } from './no-store.interceptor';

@Controller('internal-auth')
@UseGuards(ThrottlerGuard)
@UseInterceptors(NoStoreInterceptor)
export class PasskeyAuthController {
  constructor(private readonly authentication: PasskeyAuthService) {}

  @Post('passkeys/registration/options')
  @Throttle({ 'internal-auth': { limit: 5, ttl: 60_000 } })
  registrationOptions(@Body() request: PasskeyRegistrationOptionsRequest) {
    return this.authentication.registrationOptions(
      request.enrollmentToken,
      request.credentialName,
    );
  }

  @Post('passkeys/registration/verify')
  @Throttle({ 'internal-auth': { limit: 10, ttl: 60_000 } })
  verifyRegistration(@Body() request: PasskeyRegistrationVerifyRequest) {
    return this.authentication.verifyRegistration(
      request.ceremonyId,
      request.response,
    );
  }

  @Post('passkeys/authentication/options')
  @Throttle({ 'internal-auth': { limit: 10, ttl: 60_000 } })
  authenticationOptions() {
    return this.authentication.authenticationOptions();
  }

  @Post('passkeys/authentication/verify')
  @Throttle({ 'internal-auth': { limit: 10, ttl: 60_000 } })
  verifyAuthentication(@Body() request: PasskeyAuthenticationVerifyRequest) {
    return this.authentication.verifyAuthentication(
      request.ceremonyId,
      request.response,
    );
  }

  @Post('logout')
  @UseGuards(InternalSessionGuard)
  async logout(
    @CurrentInternalPrincipal() principal: InternalPrincipal,
  ): Promise<{ loggedOut: true }> {
    await this.authentication.revokeSession(principal.sessionId);
    return { loggedOut: true };
  }
}

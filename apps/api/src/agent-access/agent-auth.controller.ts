import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AgentAuthService } from './agent-auth.service';
import type { AgentPrincipal } from './agent-access.types';
import { AgentSessionGuard } from './agent-session.guard';
import { CurrentAgentPrincipal } from './current-agent-principal.decorator';
import { CompleteAgentRegistrationRequest } from './dto/complete-agent-registration.request';
import { RequestAgentOtpRequest } from './dto/request-agent-otp.request';
import { VerifyAgentOtpRequest } from './dto/verify-agent-otp.request';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';

@Controller('agent-auth')
@UseInterceptors(AgentNoStoreInterceptor)
export class AgentAuthController {
  constructor(private readonly authentication: AgentAuthService) {}

  @Post('registration/otp')
  requestRegistrationOtp(@Body() request: RequestAgentOtpRequest) {
    return this.authentication.requestRegistrationOtp(request.phone);
  }

  @Post('registration/verify')
  verifyRegistrationOtp(@Body() request: VerifyAgentOtpRequest) {
    return this.authentication.verifyRegistrationOtp(
      request.challengeId,
      request.code,
    );
  }

  @Post('registration/complete')
  completeRegistration(@Body() request: CompleteAgentRegistrationRequest) {
    return this.authentication.completeRegistration(
      request.registrationToken,
      request.name,
    );
  }

  @Post('login/otp')
  requestLoginOtp(@Body() request: RequestAgentOtpRequest) {
    return this.authentication.requestLoginOtp(request.phone);
  }

  @Post('login/verify')
  verifyLoginOtp(@Body() request: VerifyAgentOtpRequest) {
    return this.authentication.verifyLoginOtp(
      request.challengeId,
      request.code,
    );
  }

  @Get('session')
  @UseGuards(AgentSessionGuard)
  session(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return {
      agent: {
        id: principal.agentId,
        tenantId: principal.tenantId,
        name: principal.name,
        phoneMask: principal.phoneMask,
        status: principal.status,
      },
    };
  }

  @Post('logout')
  @UseGuards(AgentSessionGuard)
  async logout(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    await this.authentication.revokeSession(principal.sessionId);
    return { ok: true };
  }
}

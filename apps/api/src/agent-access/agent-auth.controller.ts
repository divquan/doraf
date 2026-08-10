import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { PricingService } from '../pricing/pricing.service';
import { SetAgentRetailPriceRequest } from '../pricing/dto/set-agent-retail-price.request';
import { SalesChannelService } from './sales-channel.service';
import { OrdersService } from '../orders/orders.service';
import { AgentOnboardingService } from './agent-onboarding.service';
import { UpdateAgentOnboardingRequest } from './dto/update-agent-onboarding.request';

@Controller('agent-auth')
@UseInterceptors(AgentNoStoreInterceptor)
export class AgentAuthController {
  constructor(
    private readonly authentication: AgentAuthService,
    private readonly pricing: PricingService,
    private readonly salesChannels: SalesChannelService,
    private readonly orders: OrdersService,
    private readonly onboarding: AgentOnboardingService,
  ) {}

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

  @Post('withdrawals/otp')
  @UseGuards(AgentSessionGuard)
  requestWithdrawalOtp(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.authentication.requestWithdrawalOtp(principal.agentId);
  }

  @Post('withdrawals/verify')
  @UseGuards(AgentSessionGuard)
  verifyWithdrawalOtp(
    @Body() request: VerifyAgentOtpRequest,
    @CurrentAgentPrincipal() principal: AgentPrincipal,
  ) {
    return this.authentication.verifyWithdrawalOtp(
      principal.agentId,
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

  @Get('onboarding')
  @UseGuards(AgentSessionGuard)
  onboardingState(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.onboarding.get(principal.agentId);
  }

  @Post('onboarding')
  @UseGuards(AgentSessionGuard)
  updateOnboarding(
    @Body() request: UpdateAgentOnboardingRequest,
    @CurrentAgentPrincipal() principal: AgentPrincipal,
  ) {
    return this.onboarding.record(principal.agentId, request.action);
  }

  @Post('logout')
  @UseGuards(AgentSessionGuard)
  async logout(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    await this.authentication.revokeSession(principal.sessionId);
    return { ok: true };
  }

  @Post('prices/:productId')
  @UseGuards(AgentSessionGuard)
  setRetailPrice(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() request: SetAgentRetailPriceRequest,
    @CurrentAgentPrincipal() principal: AgentPrincipal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.pricing.setRetailPrice({
      agentId: principal.agentId,
      productId,
      retailPriceMinor: request.retailPriceMinor,
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
  }

  @Get('prices')
  @UseGuards(AgentSessionGuard)
  listPrices(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.pricing.listForAgent(principal.agentId);
  }

  @Get('sales-channel')
  @UseGuards(AgentSessionGuard)
  salesChannel(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.salesChannels.getForAgent(principal.agentId);
  }

  @Get('orders')
  @UseGuards(AgentSessionGuard)
  listOrders(
    @CurrentAgentPrincipal() principal: AgentPrincipal,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page && /^\d+$/.test(page) ? parseInt(page, 10) : 1;
    const limitNum = limit && /^\d+$/.test(limit) ? parseInt(limit, 10) : 10;
    return this.orders.listOrdersForAgent(principal.agentId, pageNum, limitNum);
  }

  @Get('sales-summary')
  @UseGuards(AgentSessionGuard)
  salesSummary(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.orders.getAgentSalesSummary(principal.agentId);
  }
}

function requiredIdempotencyKey(value?: string): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key must contain 8 to 200 safe characters',
    );
  }
  return value;
}

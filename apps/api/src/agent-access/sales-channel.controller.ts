import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { AgentSessionGuard } from './agent-session.guard';
import { CurrentAgentPrincipal } from './current-agent-principal.decorator';
import { UpdateStorefrontRequest } from './dto/update-storefront.request';
import { SalesChannelService } from './sales-channel.service';

@Controller()
@UseInterceptors(AgentNoStoreInterceptor)
export class SalesChannelController {
  constructor(private readonly salesChannels: SalesChannelService) {}

  @Get('sales-channels/web/:identifier')
  resolve(@Param('identifier') identifier: string) {
    return this.salesChannels.resolveWebChannel(identifier);
  }

  @UseGuards(AgentSessionGuard)
  @Get('agent/storefront')
  getStorefrontSettings(@CurrentAgentPrincipal('agentId') agentId: string) {
    return this.salesChannels.getForAgent(agentId);
  }

  @UseGuards(AgentSessionGuard)
  @Patch('agent/storefront')
  updateStorefrontSettings(
    @CurrentAgentPrincipal('agentId') agentId: string,
    @Body() body: UpdateStorefrontRequest,
  ) {
    return this.salesChannels.updateStorefront(agentId, body);
  }
}

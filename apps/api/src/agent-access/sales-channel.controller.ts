import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { AgentNoStoreInterceptor } from './agent-no-store.interceptor';
import { SalesChannelService } from './sales-channel.service';

@Controller('sales-channels/web')
@UseInterceptors(AgentNoStoreInterceptor)
export class SalesChannelController {
  constructor(private readonly salesChannels: SalesChannelService) {}

  @Get(':webSalesId')
  resolve(@Param('webSalesId') webSalesId: string) {
    return this.salesChannels.resolveWebChannel(webSalesId);
  }
}

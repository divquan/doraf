import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { AgentPrincipal } from '../agent-access/agent-access.types';
import { AgentNoStoreInterceptor } from '../agent-access/agent-no-store.interceptor';
import { AgentSessionGuard } from '../agent-access/agent-session.guard';
import { CurrentAgentPrincipal } from '../agent-access/current-agent-principal.decorator';
import { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto';
import { WalletService } from './wallet.service';

@Controller('agent-wallet')
@UseGuards(AgentSessionGuard)
@UseInterceptors(AgentNoStoreInterceptor)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('summary')
  getSummary(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.walletService.getSummary(principal.agentId);
  }

  @Get('transactions')
  getTransactions(
    @CurrentAgentPrincipal() principal: AgentPrincipal,
    @Query() query: WalletTransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(principal.agentId, query);
  }
}

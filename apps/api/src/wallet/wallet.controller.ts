import {
  Controller,
  Body,
  Get,
  Post,
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
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalRequest } from './dto/create-withdrawal.request';

@Controller('agent-wallet')
@UseGuards(AgentSessionGuard)
@UseInterceptors(AgentNoStoreInterceptor)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

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

  @Get('withdrawals')
  listWithdrawals(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.withdrawals.listForAgent(principal.agentId);
  }

  @Post('withdrawals')
  createWithdrawal(
    @Body() request: CreateWithdrawalRequest,
    @CurrentAgentPrincipal() principal: AgentPrincipal,
  ) {
    return this.withdrawals.request({ agentId: principal.agentId, ...request });
  }

  @Get('payout-destination')
  getPayoutDestination(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.withdrawals.getPayoutDestination(principal.agentId);
  }

  @Post('payout-destination/validate')
  validatePayoutDestination(
    @Body() body: { network: string; accountNumber: string },
    @CurrentAgentPrincipal() principal: AgentPrincipal,
  ) {
    return this.withdrawals.validatePayoutDestination(principal.agentId, body);
  }

  @Post('payout-destination')
  savePayoutDestination(
    @Body() body: { network: string; accountNumber: string },
    @CurrentAgentPrincipal() principal: AgentPrincipal,
  ) {
    return this.withdrawals.savePayoutDestination(principal.agentId, body);
  }
}

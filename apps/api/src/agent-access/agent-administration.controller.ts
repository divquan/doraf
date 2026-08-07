import {
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
import { randomUUID } from 'node:crypto';
import { AgentStatus, InternalRole } from '../generated/prisma/client';
import { CurrentInternalPrincipal } from '../internal-access/current-internal-principal.decorator';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { OrdersService } from '../orders/orders.service';
import { AgentAdministrationService } from './agent-administration.service';
import { ChangeAgentStatusRequest } from './dto/change-agent-status.request';

@Controller('admin/agents')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
@UseInterceptors(NoStoreInterceptor)
export class AgentAdministrationController {
  constructor(
    private readonly agents: AgentAdministrationService,
    private readonly orders: OrdersService,
  ) {}

  @Get(':agentId')
  getAgent(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
  ) {
    return this.agents.getById(agentId);
  }

  @Get(':agentId/summary')
  salesSummary(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
  ) {
    return this.orders.getAgentSalesSummaryForAdmin(agentId);
  }

  @Get(':agentId/orders')
  listOrders(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page && /^\d+$/.test(page) ? parseInt(page, 10) : 1;
    const limitNum = limit && /^\d+$/.test(limit) ? parseInt(limit, 10) : 10;
    return this.orders.listOrdersForAgent(agentId, pageNum, limitNum);
  }

  @Post(':agentId/suspend')
  suspend(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() request: ChangeAgentStatusRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.agents.changeStatus({
      agentId,
      status: AgentStatus.SUSPENDED,
      reason: request.reason,
      requestId: safeRequestId(requestId),
      actor,
    });
  }

  @Post(':agentId/restore')
  restore(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() request: ChangeAgentStatusRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.agents.changeStatus({
      agentId,
      status: AgentStatus.ACTIVE,
      reason: request.reason,
      requestId: safeRequestId(requestId),
      actor,
    });
  }
}

function safeRequestId(value: string | undefined): string {
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : randomUUID();
}

import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AgentAdministrationService } from './agent-administration.service';
import { ChangeAgentStatusRequest } from './dto/change-agent-status.request';

@Controller('admin/agents')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
@UseInterceptors(NoStoreInterceptor)
export class AgentAdministrationController {
  constructor(private readonly agents: AgentAdministrationService) {}

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

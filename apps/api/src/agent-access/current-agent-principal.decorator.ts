import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AgentPrincipal } from './agent-access.types';
import type { AgentAuthenticatedRequest } from './agent-session.guard';

export const CurrentAgentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AgentPrincipal => {
    const principal = context
      .switchToHttp()
      .getRequest<AgentAuthenticatedRequest>().agentPrincipal;
    if (!principal) {
      throw new Error('Agent principal was not populated by the guard');
    }
    return principal;
  },
);

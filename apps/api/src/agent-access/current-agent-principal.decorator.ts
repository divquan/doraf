import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AgentPrincipal } from './agent-access.types';
import type { AgentAuthenticatedRequest } from './agent-session.guard';

export const CurrentAgentPrincipal = createParamDecorator(
  (data: keyof AgentPrincipal | undefined, context: ExecutionContext) => {
    const principal = context
      .switchToHttp()
      .getRequest<AgentAuthenticatedRequest>().agentPrincipal;
    if (!principal) {
      throw new Error('Agent principal was not populated by the guard');
    }
    return data ? principal[data] : principal;
  },
);

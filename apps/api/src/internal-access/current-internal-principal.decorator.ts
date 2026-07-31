import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { InternalAuthenticatedRequest } from './internal-session.guard';
import type { InternalPrincipal } from './internal-access.types';

export const CurrentInternalPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): InternalPrincipal => {
    const principal = context
      .switchToHttp()
      .getRequest<InternalAuthenticatedRequest>().internalPrincipal;
    if (!principal) {
      throw new Error('Internal principal was not populated by the guard');
    }
    return principal;
  },
);

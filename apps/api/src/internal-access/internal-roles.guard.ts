import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { InternalRole } from '../generated/prisma/client';
import type { InternalAuthenticatedRequest } from './internal-session.guard';
import { INTERNAL_ROLES_KEY } from './internal-access.types';

@Injectable()
export class InternalRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<InternalRole[]>(
      INTERNAL_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) {
      return true;
    }

    const principal = context
      .switchToHttp()
      .getRequest<InternalAuthenticatedRequest>().internalPrincipal;
    if (!principal) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!roles.includes(principal.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

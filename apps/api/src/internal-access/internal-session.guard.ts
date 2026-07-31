import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  INTERNAL_SESSION_REPOSITORY,
  type InternalPrincipal,
  type InternalSessionRepository,
} from './internal-access.types';
import { SessionTokenService } from './session-token.service';

export interface InternalAuthenticatedRequest extends Request {
  internalPrincipal?: InternalPrincipal;
}

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class InternalSessionGuard implements CanActivate {
  constructor(
    private readonly tokens: SessionTokenService,
    @Inject(INTERNAL_SESSION_REPOSITORY)
    private readonly sessions: InternalSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<InternalAuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const principal = await this.sessions.findActiveByFingerprint(
      this.tokens.fingerprint(token),
      new Date(),
    );
    if (!principal) {
      throw new UnauthorizedException('Authentication required');
    }

    request.internalPrincipal = principal;
    return true;
  }

  private extractToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    const [scheme, token, extra] = authorization?.split(' ') ?? [];
    if (
      scheme !== 'Bearer' ||
      !token ||
      extra !== undefined ||
      !opaqueTokenPattern.test(token)
    ) {
      return null;
    }
    return token;
  }
}

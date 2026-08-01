import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { SessionTokenService } from '../internal-access/session-token.service';
import type { AgentPrincipal } from './agent-access.types';

export interface AgentAuthenticatedRequest extends Request {
  agentPrincipal?: AgentPrincipal;
}

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class AgentSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: SessionTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AgentAuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }
    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: {
        tokenFingerprint: Uint8Array.from(this.tokens.fingerprint(token)),
      },
      select: {
        id: true,
        agentId: true,
        authenticatedAt: true,
        expiresAt: true,
        revokedAt: true,
        agent: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            phoneMask: true,
            status: true,
          },
        },
      },
    });
    if (
      !session?.agent ||
      !session.agentId ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new UnauthorizedException('Authentication required');
    }

    request.agentPrincipal = {
      agentId: session.agent.id,
      tenantId: session.agent.tenantId,
      sessionId: session.id,
      name: session.agent.name,
      phoneMask: session.agent.phoneMask,
      status: session.agent.status,
      authenticatedAt: session.authenticatedAt,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const [scheme, token, extra] =
      request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' &&
      token &&
      extra === undefined &&
      opaqueTokenPattern.test(token)
      ? token
      : null;
  }
}

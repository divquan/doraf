import { Injectable } from '@nestjs/common';
import { InternalUserStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  AuthenticationStrength,
  InternalPrincipal,
  InternalSessionRepository,
} from './internal-access.types';

@Injectable()
export class PrismaInternalSessionRepository implements InternalSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByFingerprint(
    fingerprint: Uint8Array,
    now: Date,
  ): Promise<InternalPrincipal | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenFingerprint: Uint8Array.from(fingerprint) },
      select: {
        id: true,
        internalUserId: true,
        authenticationStrength: true,
        authenticatedAt: true,
        stepUpAt: true,
        expiresAt: true,
        revokedAt: true,
        internalUser: {
          select: {
            id: true,
            displayName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (
      !session?.internalUser ||
      !session.internalUserId ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.internalUser.status !== InternalUserStatus.ACTIVE
    ) {
      return null;
    }

    return {
      userId: session.internalUser.id,
      sessionId: session.id,
      displayName: session.internalUser.displayName,
      role: session.internalUser.role,
      authenticationStrength:
        session.authenticationStrength as AuthenticationStrength,
      authenticatedAt: session.authenticatedAt,
      stepUpAt: session.stepUpAt,
    };
  }
}

import type { InternalRole } from '../generated/prisma/client';

export const INTERNAL_SESSION_REPOSITORY = Symbol(
  'INTERNAL_SESSION_REPOSITORY',
);
export const INTERNAL_ROLES_KEY = 'doraf:internal-roles';

export type AuthenticationStrength = 'PRIMARY' | 'MFA' | 'PHISHING_RESISTANT';

export interface InternalPrincipal {
  userId: string;
  sessionId: string;
  displayName: string;
  role: InternalRole;
  authenticationStrength: AuthenticationStrength;
  authenticatedAt: Date;
  stepUpAt: Date | null;
}

export interface InternalSessionRepository {
  findActiveByFingerprint(
    fingerprint: Uint8Array,
    now: Date,
  ): Promise<InternalPrincipal | null>;
}

import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { InternalRole } from '../generated/prisma/client';

export const INTERNAL_AUTH_REPOSITORY = Symbol('INTERNAL_AUTH_REPOSITORY');

export interface PasskeySummary {
  credentialId: string;
  transports: AuthenticatorTransportFuture[];
}

export interface EnrollmentContext {
  enrollmentTokenId: string;
  internalUserId: string;
  displayName: string;
  passkeys: PasskeySummary[];
}

export interface RegistrationCeremonyContext {
  id: string;
  challenge: string;
  credentialName: string;
  internalUserId: string;
  internalUserRole: InternalRole;
  enrollmentTokenId: string;
}

export interface AuthenticationCeremonyContext {
  id: string;
  challenge: string;
  credential: {
    id: string;
    internalUserId: string;
    displayName: string;
    role: InternalRole;
    credentialId: string;
    publicKey: Uint8Array<ArrayBuffer>;
    counter: bigint;
    transports: AuthenticatorTransportFuture[];
  };
}

export interface CompletePasskeyRegistrationInput {
  ceremony: RegistrationCeremonyContext;
  credentialId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: AuthenticatorTransportFuture[];
  deviceType: CredentialDeviceType;
  backedUp: boolean;
  aaguid: string;
  now: Date;
}

export interface CompletePasskeyAuthenticationInput {
  ceremony: AuthenticationCeremonyContext;
  newCounter: number;
  backedUp: boolean;
  sessionFingerprint: Uint8Array;
  sessionExpiresAt: Date;
  now: Date;
}

export interface CreateInternalUserInput {
  displayName: string;
  role: InternalRole;
  tokenFingerprint: Uint8Array;
  tokenExpiresAt: Date;
  actorId: string;
  actorRole: InternalRole;
  authenticationStrength: string;
  reason: string;
  requestId: string;
  now: Date;
}

export interface InternalAuthRepository {
  findEnrollmentContext(
    tokenFingerprint: Uint8Array,
    now: Date,
  ): Promise<EnrollmentContext | null>;
  createRegistrationCeremony(input: {
    context: EnrollmentContext;
    challenge: string;
    credentialName: string;
    expiresAt: Date;
  }): Promise<string>;
  findRegistrationCeremony(
    ceremonyId: string,
    now: Date,
  ): Promise<RegistrationCeremonyContext | null>;
  failCeremony(ceremonyId: string): Promise<void>;
  completeRegistration(input: CompletePasskeyRegistrationInput): Promise<void>;
  createAuthenticationCeremony(input: {
    challenge: string;
    expiresAt: Date;
  }): Promise<string>;
  findAuthenticationCeremony(
    ceremonyId: string,
    credentialId: string,
    now: Date,
  ): Promise<AuthenticationCeremonyContext | null>;
  completeAuthentication(input: CompletePasskeyAuthenticationInput): Promise<{
    sessionId: string;
    internalUserId: string;
    displayName: string;
    role: InternalRole;
  }>;
  createInternalUser(input: CreateInternalUserInput): Promise<string>;
  createEnrollmentToken(input: {
    internalUserId: string;
    tokenFingerprint: Uint8Array;
    tokenExpiresAt: Date;
    actorId: string;
    actorRole: InternalRole;
    authenticationStrength: string;
    reason: string;
    requestId: string;
    now: Date;
  }): Promise<void>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
}

export interface VerifyRegistrationCommand {
  ceremonyId: string;
  response: RegistrationResponseJSON;
}

export interface VerifyAuthenticationCommand {
  ceremonyId: string;
  response: AuthenticationResponseJSON;
}

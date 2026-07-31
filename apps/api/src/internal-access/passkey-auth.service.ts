import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { AppEnvironment } from '../config/environment';
import type { InternalRole } from '../generated/prisma/client';
import { EnrollmentTokenService } from './enrollment-token.service';
import {
  InternalAuthStateError,
  InternalUserUnavailableError,
  PasskeyAlreadyRegisteredError,
} from './passkey-auth.errors';
import {
  INTERNAL_AUTH_REPOSITORY,
  type InternalAuthRepository,
} from './passkey-auth.types';
import { PASSKEY_SERVER, type PasskeyServer } from './passkey-server.adapter';
import { SessionTokenService } from './session-token.service';
import type { InternalPrincipal } from './internal-access.types';

@Injectable()
export class PasskeyAuthService {
  private readonly relyingPartyName: string;
  private readonly relyingPartyId: string;
  private readonly origin: string;
  private readonly challengeTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly enrollmentTtlMs: number;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    @Inject(INTERNAL_AUTH_REPOSITORY)
    private readonly repository: InternalAuthRepository,
    @Inject(PASSKEY_SERVER) private readonly passkeys: PasskeyServer,
    private readonly enrollmentTokens: EnrollmentTokenService,
    private readonly sessionTokens: SessionTokenService,
  ) {
    this.relyingPartyName = config.get('INTERNAL_AUTH_RP_NAME', {
      infer: true,
    });
    this.relyingPartyId = config.get('INTERNAL_AUTH_RP_ID', { infer: true });
    this.origin = config.get('INTERNAL_AUTH_ORIGIN', { infer: true });
    this.challengeTtlMs =
      config.get('INTERNAL_AUTH_CHALLENGE_TTL_SECONDS', { infer: true }) *
      1_000;
    this.sessionTtlMs =
      config.get('INTERNAL_AUTH_SESSION_TTL_SECONDS', { infer: true }) * 1_000;
    this.enrollmentTtlMs =
      config.get('INTERNAL_ENROLLMENT_TTL_SECONDS', { infer: true }) * 1_000;
  }

  async registrationOptions(
    enrollmentToken: string,
    credentialName: string,
  ): Promise<{
    ceremonyId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }> {
    const now = new Date();
    const context = await this.repository.findEnrollmentContext(
      this.enrollmentTokens.fingerprint(enrollmentToken),
      now,
    );
    if (!context) {
      throw new UnauthorizedException('Enrollment is unavailable');
    }

    const options = await this.passkeys.registrationOptions({
      relyingPartyName: this.relyingPartyName,
      relyingPartyId: this.relyingPartyId,
      userId: uuidToBytes(context.internalUserId),
      userName: `internal-${context.internalUserId}`,
      userDisplayName: context.displayName,
      excludeCredentials: context.passkeys.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      timeoutMs: this.challengeTtlMs,
    });
    const ceremonyId = await this.repository.createRegistrationCeremony({
      context,
      challenge: options.challenge,
      credentialName: credentialName.trim(),
      expiresAt: new Date(now.getTime() + this.challengeTtlMs),
    });
    return { ceremonyId, options };
  }

  async verifyRegistration(
    ceremonyId: string,
    response: RegistrationResponseJSON,
  ): Promise<{ registered: true }> {
    const now = new Date();
    const ceremony = await this.repository.findRegistrationCeremony(
      ceremonyId,
      now,
    );
    if (!ceremony) {
      throw new UnauthorizedException('Enrollment is unavailable');
    }

    let verification;
    try {
      verification = await this.passkeys.verifyRegistration({
        response,
        challenge: ceremony.challenge,
        origin: this.origin,
        relyingPartyId: this.relyingPartyId,
      });
    } catch {
      await this.repository.failCeremony(ceremony.id);
      throw new BadRequestException(
        'Passkey registration could not be verified',
      );
    }
    if (!verification.verified) {
      await this.repository.failCeremony(ceremony.id);
      throw new BadRequestException(
        'Passkey registration could not be verified',
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
      verification.registrationInfo;
    try {
      await this.repository.completeRegistration({
        ceremony,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        aaguid,
        now,
      });
    } catch (error: unknown) {
      if (error instanceof PasskeyAlreadyRegisteredError) {
        throw new ConflictException('Passkey is already registered');
      }
      if (error instanceof InternalAuthStateError) {
        throw new UnauthorizedException('Enrollment is unavailable');
      }
      throw error;
    }
    return { registered: true };
  }

  async authenticationOptions(): Promise<{
    ceremonyId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }> {
    const now = new Date();
    const options = await this.passkeys.authenticationOptions({
      relyingPartyId: this.relyingPartyId,
      timeoutMs: this.challengeTtlMs,
    });
    const ceremonyId = await this.repository.createAuthenticationCeremony({
      challenge: options.challenge,
      expiresAt: new Date(now.getTime() + this.challengeTtlMs),
    });
    return { ceremonyId, options };
  }

  async verifyAuthentication(
    ceremonyId: string,
    response: AuthenticationResponseJSON,
  ): Promise<{
    token: string;
    expiresAt: string;
    user: { id: string; displayName: string; role: InternalRole };
  }> {
    const now = new Date();
    const ceremony = await this.repository.findAuthenticationCeremony(
      ceremonyId,
      response.id,
      now,
    );
    if (!ceremony) {
      await this.repository.failCeremony(ceremonyId);
      throw new UnauthorizedException('Authentication failed');
    }

    let verification;
    try {
      verification = await this.passkeys.verifyAuthentication({
        response,
        challenge: ceremony.challenge,
        origin: this.origin,
        relyingPartyId: this.relyingPartyId,
        credential: {
          id: ceremony.credential.credentialId,
          publicKey: ceremony.credential.publicKey,
          counter: Number(ceremony.credential.counter),
          transports: ceremony.credential.transports,
        },
      });
    } catch {
      await this.repository.failCeremony(ceremony.id);
      throw new UnauthorizedException('Authentication failed');
    }
    if (
      !verification.verified ||
      !verification.authenticationInfo.userVerified
    ) {
      await this.repository.failCeremony(ceremony.id);
      throw new UnauthorizedException('Authentication failed');
    }

    const session = this.sessionTokens.create();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);
    let principal;
    try {
      principal = await this.repository.completeAuthentication({
        ceremony,
        newCounter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        sessionFingerprint: session.fingerprint,
        sessionExpiresAt: expiresAt,
        now,
      });
    } catch (error: unknown) {
      if (error instanceof InternalAuthStateError) {
        throw new UnauthorizedException('Authentication failed');
      }
      throw error;
    }
    return {
      token: session.token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: principal.internalUserId,
        displayName: principal.displayName,
        role: principal.role,
      },
    };
  }

  async inviteInternalUser(input: {
    displayName: string;
    role: InternalRole;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }): Promise<{
    userId: string;
    enrollmentToken: string;
    enrollmentExpiresAt: string;
  }> {
    const now = new Date();
    const token = this.enrollmentTokens.create();
    const expiresAt = new Date(now.getTime() + this.enrollmentTtlMs);
    const userId = await this.repository.createInternalUser({
      displayName: input.displayName.trim(),
      role: input.role,
      tokenFingerprint: token.fingerprint,
      tokenExpiresAt: expiresAt,
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      authenticationStrength: input.actor.authenticationStrength,
      reason: input.reason.trim(),
      requestId: input.requestId,
      now,
    });
    return {
      userId,
      enrollmentToken: token.token,
      enrollmentExpiresAt: expiresAt.toISOString(),
    };
  }

  async createEnrollmentToken(input: {
    internalUserId: string;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }): Promise<{
    enrollmentToken: string;
    enrollmentExpiresAt: string;
  }> {
    const now = new Date();
    const token = this.enrollmentTokens.create();
    const expiresAt = new Date(now.getTime() + this.enrollmentTtlMs);
    try {
      await this.repository.createEnrollmentToken({
        internalUserId: input.internalUserId,
        tokenFingerprint: token.fingerprint,
        tokenExpiresAt: expiresAt,
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        authenticationStrength: input.actor.authenticationStrength,
        reason: input.reason.trim(),
        requestId: input.requestId,
        now,
      });
    } catch (error: unknown) {
      if (error instanceof InternalUserUnavailableError) {
        throw new NotFoundException('Internal user is unavailable');
      }
      throw error;
    }
    return {
      enrollmentToken: token.token,
      enrollmentExpiresAt: expiresAt.toISOString(),
    };
  }

  revokeSession(sessionId: string): Promise<void> {
    return this.repository.revokeSession(sessionId, new Date());
  }
}

function uuidToBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(value.replaceAll('-', ''), 'hex'));
}

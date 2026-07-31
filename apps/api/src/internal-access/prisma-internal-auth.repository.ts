import { Injectable } from '@nestjs/common';
import {
  InternalAuthCeremonyType,
  type InternalRole,
  InternalUserStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  InternalAuthStateError,
  InternalUserUnavailableError,
  PasskeyAlreadyRegisteredError,
} from './passkey-auth.errors';
import type {
  AuthenticationCeremonyContext,
  CompletePasskeyAuthenticationInput,
  CompletePasskeyRegistrationInput,
  CreateInternalUserInput,
  EnrollmentContext,
  InternalAuthRepository,
  RegistrationCeremonyContext,
} from './passkey-auth.types';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

@Injectable()
export class PrismaInternalAuthRepository implements InternalAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEnrollmentContext(
    tokenFingerprint: Uint8Array,
    now: Date,
  ): Promise<EnrollmentContext | null> {
    const token = await this.prisma.internalEnrollmentToken.findUnique({
      where: { tokenFingerprint: Uint8Array.from(tokenFingerprint) },
      select: {
        id: true,
        expiresAt: true,
        consumedAt: true,
        internalUser: {
          select: {
            id: true,
            displayName: true,
            status: true,
            credentials: {
              where: { revokedAt: null },
              select: { credentialId: true, transports: true },
            },
          },
        },
      },
    });
    if (
      !token ||
      token.consumedAt !== null ||
      token.expiresAt <= now ||
      token.internalUser.status !== InternalUserStatus.ACTIVE
    ) {
      return null;
    }

    return {
      enrollmentTokenId: token.id,
      internalUserId: token.internalUser.id,
      displayName: token.internalUser.displayName,
      passkeys: token.internalUser.credentials.map((credential) => ({
        credentialId: credential.credentialId,
        transports: toTransports(credential.transports),
      })),
    };
  }

  async createRegistrationCeremony(input: {
    context: EnrollmentContext;
    challenge: string;
    credentialName: string;
    expiresAt: Date;
  }): Promise<string> {
    const ceremony = await this.prisma.internalAuthCeremony.create({
      data: {
        type: InternalAuthCeremonyType.PASSKEY_REGISTRATION,
        internalUserId: input.context.internalUserId,
        enrollmentTokenId: input.context.enrollmentTokenId,
        challenge: input.challenge,
        credentialName: input.credentialName,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return ceremony.id;
  }

  async findRegistrationCeremony(
    ceremonyId: string,
    now: Date,
  ): Promise<RegistrationCeremonyContext | null> {
    const ceremony = await this.prisma.internalAuthCeremony.findFirst({
      where: {
        id: ceremonyId,
        type: InternalAuthCeremonyType.PASSKEY_REGISTRATION,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: 5 },
        enrollmentToken: { consumedAt: null, expiresAt: { gt: now } },
        internalUser: { status: InternalUserStatus.ACTIVE },
      },
      select: {
        id: true,
        challenge: true,
        credentialName: true,
        internalUserId: true,
        enrollmentTokenId: true,
        internalUser: { select: { role: true } },
      },
    });
    if (
      !ceremony?.credentialName ||
      !ceremony.internalUserId ||
      !ceremony.enrollmentTokenId ||
      !ceremony.internalUser
    ) {
      return null;
    }
    return {
      id: ceremony.id,
      challenge: ceremony.challenge,
      credentialName: ceremony.credentialName,
      internalUserId: ceremony.internalUserId,
      internalUserRole: ceremony.internalUser.role,
      enrollmentTokenId: ceremony.enrollmentTokenId,
    };
  }

  async failCeremony(ceremonyId: string): Promise<void> {
    await this.prisma.internalAuthCeremony.updateMany({
      where: { id: ceremonyId, consumedAt: null, attemptCount: { lt: 5 } },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async completeRegistration(
    input: CompletePasskeyRegistrationInput,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const ceremony = await transaction.internalAuthCeremony.updateMany({
            where: {
              id: input.ceremony.id,
              consumedAt: null,
              expiresAt: { gt: input.now },
              attemptCount: { lt: 5 },
            },
            data: { consumedAt: input.now },
          });
          const token = await transaction.internalEnrollmentToken.updateMany({
            where: {
              id: input.ceremony.enrollmentTokenId,
              internalUserId: input.ceremony.internalUserId,
              consumedAt: null,
              expiresAt: { gt: input.now },
            },
            data: { consumedAt: input.now },
          });
          if (ceremony.count !== 1 || token.count !== 1) {
            throw new InternalAuthStateError();
          }

          const credential = await transaction.internalCredential.create({
            data: {
              internalUserId: input.ceremony.internalUserId,
              name: input.ceremony.credentialName,
              credentialId: input.credentialId,
              publicKey: Uint8Array.from(input.publicKey),
              counter: BigInt(input.counter),
              transports: input.transports,
              deviceType: input.deviceType,
              backedUp: input.backedUp,
              aaguid: input.aaguid.toLowerCase(),
            },
            select: { id: true },
          });
          await transaction.auditEvent.create({
            data: {
              actorInternalUserId: input.ceremony.internalUserId,
              actorRole: input.ceremony.internalUserRole,
              action: 'INTERNAL_PASSKEY_REGISTERED',
              entityType: 'INTERNAL_CREDENTIAL',
              entityId: credential.id,
              reason: `Registered passkey: ${input.ceremony.credentialName}`,
              authenticationStrength: 'PHISHING_RESISTANT',
              requestId: input.ceremony.id,
              safeMetadata: {
                deviceType: input.deviceType,
                backedUp: input.backedUp,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PasskeyAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async createAuthenticationCeremony(input: {
    challenge: string;
    expiresAt: Date;
  }): Promise<string> {
    const ceremony = await this.prisma.internalAuthCeremony.create({
      data: {
        type: InternalAuthCeremonyType.PASSKEY_AUTHENTICATION,
        challenge: input.challenge,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    return ceremony.id;
  }

  async findAuthenticationCeremony(
    ceremonyId: string,
    credentialId: string,
    now: Date,
  ): Promise<AuthenticationCeremonyContext | null> {
    const ceremony = await this.prisma.internalAuthCeremony.findFirst({
      where: {
        id: ceremonyId,
        type: InternalAuthCeremonyType.PASSKEY_AUTHENTICATION,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: 5 },
      },
      select: { id: true, challenge: true },
    });
    if (!ceremony) {
      return null;
    }
    const credential = await this.prisma.internalCredential.findUnique({
      where: { credentialId },
      select: {
        id: true,
        internalUserId: true,
        credentialId: true,
        publicKey: true,
        counter: true,
        transports: true,
        revokedAt: true,
        internalUser: {
          select: { displayName: true, role: true, status: true },
        },
      },
    });
    if (
      !credential ||
      credential.revokedAt !== null ||
      credential.internalUser.status !== InternalUserStatus.ACTIVE
    ) {
      return null;
    }
    return {
      id: ceremony.id,
      challenge: ceremony.challenge,
      credential: {
        id: credential.id,
        internalUserId: credential.internalUserId,
        displayName: credential.internalUser.displayName,
        role: credential.internalUser.role,
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: toTransports(credential.transports),
      },
    };
  }

  async completeAuthentication(
    input: CompletePasskeyAuthenticationInput,
  ): Promise<{
    sessionId: string;
    internalUserId: string;
    displayName: string;
    role: (typeof input.ceremony.credential)['role'];
  }> {
    return this.prisma.$transaction(
      async (transaction) => {
        const ceremony = await transaction.internalAuthCeremony.updateMany({
          where: {
            id: input.ceremony.id,
            consumedAt: null,
            expiresAt: { gt: input.now },
            attemptCount: { lt: 5 },
          },
          data: { consumedAt: input.now },
        });
        const credential = await transaction.internalCredential.updateMany({
          where: {
            id: input.ceremony.credential.id,
            internalUserId: input.ceremony.credential.internalUserId,
            revokedAt: null,
          },
          data: {
            counter: BigInt(input.newCounter),
            backedUp: input.backedUp,
            lastUsedAt: input.now,
          },
        });
        if (ceremony.count !== 1 || credential.count !== 1) {
          throw new InternalAuthStateError();
        }
        const session = await transaction.session.create({
          data: {
            internalUserId: input.ceremony.credential.internalUserId,
            tokenFingerprint: Uint8Array.from(input.sessionFingerprint),
            authenticationStrength: 'PHISHING_RESISTANT',
            authenticatedAt: input.now,
            stepUpAt: input.now,
            expiresAt: input.sessionExpiresAt,
          },
          select: { id: true },
        });
        return {
          sessionId: session.id,
          internalUserId: input.ceremony.credential.internalUserId,
          displayName: input.ceremony.credential.displayName,
          role: input.ceremony.credential.role,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createInternalUser(input: CreateInternalUserInput): Promise<string> {
    return this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.internalUser.create({
          data: { displayName: input.displayName, role: input.role },
          select: { id: true },
        });
        await transaction.internalEnrollmentToken.create({
          data: {
            internalUserId: user.id,
            createdByInternalUserId: input.actorId,
            tokenFingerprint: Uint8Array.from(input.tokenFingerprint),
            expiresAt: input.tokenExpiresAt,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actorId,
            actorRole: input.actorRole,
            action: 'INTERNAL_USER_INVITED',
            entityType: 'INTERNAL_USER',
            entityId: user.id,
            reason: input.reason,
            authenticationStrength: input.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: { role: input.role },
          },
        });
        return user.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createEnrollmentToken(input: {
    internalUserId: string;
    tokenFingerprint: Uint8Array;
    tokenExpiresAt: Date;
    actorId: string;
    actorRole: InternalRole;
    authenticationStrength: string;
    reason: string;
    requestId: string;
    now: Date;
  }): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.internalUser.findFirst({
          where: {
            id: input.internalUserId,
            status: InternalUserStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (!user) {
          throw new InternalUserUnavailableError();
        }
        await transaction.internalEnrollmentToken.updateMany({
          where: {
            internalUserId: user.id,
            consumedAt: null,
          },
          data: { consumedAt: input.now },
        });
        await transaction.internalEnrollmentToken.create({
          data: {
            internalUserId: user.id,
            createdByInternalUserId: input.actorId,
            tokenFingerprint: Uint8Array.from(input.tokenFingerprint),
            expiresAt: input.tokenExpiresAt,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actorId,
            actorRole: input.actorRole,
            action: 'INTERNAL_PASSKEY_ENROLLMENT_ISSUED',
            entityType: 'INTERNAL_USER',
            entityId: user.id,
            reason: input.reason,
            authenticationStrength: input.authenticationStrength,
            requestId: input.requestId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

function toTransports(values: string[]): AuthenticatorTransportFuture[] {
  return values.filter(isTransport);
}

function isTransport(value: string): value is AuthenticatorTransportFuture {
  return [
    'ble',
    'cable',
    'hybrid',
    'internal',
    'nfc',
    'smart-card',
    'usb',
  ].includes(value);
}

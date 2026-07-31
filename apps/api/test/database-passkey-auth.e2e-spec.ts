import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { InternalAuthStateError } from '../src/internal-access/passkey-auth.errors';
import { PrismaInternalAuthRepository } from '../src/internal-access/prisma-internal-auth.repository';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for passkey database tests');
}

describe('passkey authentication transactions', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let repository: PrismaInternalAuthRepository;

  beforeAll(async () => {
    const config = {
      get: jest.fn().mockReturnValue(databaseUrl),
    } as unknown as ConfigService<AppEnvironment, true>;
    module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        PrismaInternalAuthRepository,
      ],
    }).compile();
    prisma = module.get(PrismaService);
    repository = module.get(PrismaInternalAuthRepository);
  });

  afterAll(async () => {
    await module.close();
  });

  it('consumes enrollment and authentication ceremonies exactly once', async () => {
    const now = new Date();
    const user = await prisma.internalUser.create({
      data: {
        displayName: 'Passkey Database Administrator',
        role: 'ADMINISTRATOR',
      },
      select: { id: true },
    });
    const enrollmentFingerprint = randomBytes(32);
    await prisma.internalEnrollmentToken.create({
      data: {
        internalUserId: user.id,
        tokenFingerprint: enrollmentFingerprint,
        expiresAt: new Date(now.getTime() + 300_000),
      },
    });
    const enrollment = await repository.findEnrollmentContext(
      enrollmentFingerprint,
      now,
    );
    expect(enrollment).not.toBeNull();
    if (!enrollment) {
      throw new Error('Enrollment fixture was not found');
    }

    const registrationCeremonyId = await repository.createRegistrationCeremony({
      context: enrollment,
      challenge: randomBytes(32).toString('base64url'),
      credentialName: 'Database passkey',
      expiresAt: new Date(now.getTime() + 300_000),
    });
    const registration = await repository.findRegistrationCeremony(
      registrationCeremonyId,
      now,
    );
    expect(registration).not.toBeNull();
    if (!registration) {
      throw new Error('Registration ceremony fixture was not found');
    }

    const credentialId = randomBytes(32).toString('base64url');
    const registrationInput = {
      ceremony: registration,
      credentialId,
      publicKey: Uint8Array.from(randomBytes(77)),
      counter: 0,
      transports: ['internal' as const],
      deviceType: 'multiDevice' as const,
      backedUp: true,
      aaguid: '00000000-0000-0000-0000-000000000000',
      now,
    };
    await repository.completeRegistration(registrationInput);
    await expect(
      repository.completeRegistration(registrationInput),
    ).rejects.toBeInstanceOf(InternalAuthStateError);
    await expect(
      prisma.internalCredential.count({ where: { internalUserId: user.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: {
          actorInternalUserId: user.id,
          action: 'INTERNAL_PASSKEY_REGISTERED',
        },
      }),
    ).resolves.toBe(1);

    const authenticationCeremonyId =
      await repository.createAuthenticationCeremony({
        challenge: randomBytes(32).toString('base64url'),
        expiresAt: new Date(now.getTime() + 300_000),
      });
    const authentication = await repository.findAuthenticationCeremony(
      authenticationCeremonyId,
      credentialId,
      now,
    );
    expect(authentication).not.toBeNull();
    if (!authentication) {
      throw new Error('Authentication ceremony fixture was not found');
    }
    const authenticationInput = {
      ceremony: authentication,
      newCounter: 1,
      backedUp: true,
      sessionFingerprint: randomBytes(32),
      sessionExpiresAt: new Date(now.getTime() + 28_800_000),
      now,
    };
    const session =
      await repository.completeAuthentication(authenticationInput);
    expect(session.internalUserId).toBe(user.id);
    await expect(
      repository.completeAuthentication(authenticationInput),
    ).rejects.toBeInstanceOf(InternalAuthStateError);
    await expect(
      prisma.session.count({ where: { internalUserId: user.id } }),
    ).resolves.toBe(1);
  }, 20_000);
});

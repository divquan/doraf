import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { AppEnvironment } from '../config/environment';
import { EnrollmentTokenService } from './enrollment-token.service';
import { PasskeyAuthService } from './passkey-auth.service';
import type { InternalAuthRepository } from './passkey-auth.types';
import type { PasskeyServer } from './passkey-server.adapter';
import { SessionTokenService } from './session-token.service';

describe('PasskeyAuthService', () => {
  const userId = '09020e21-530f-49ad-b20f-335b220b05ef';
  const ceremonyId = '9d5b090f-658a-4487-aac6-d626399641ec';
  const enrollmentTokenId = '0d369fd7-e449-4332-8708-267eca74cfe6';
  let repository: jest.Mocked<InternalAuthRepository>;
  let passkeys: jest.Mocked<PasskeyServer>;
  let service: PasskeyAuthService;
  let enrollmentTokens: EnrollmentTokenService;

  beforeEach(() => {
    const values: Record<string, unknown> = {
      INTERNAL_AUTH_RP_NAME: 'Dashchecker Administration',
      INTERNAL_AUTH_RP_ID: 'localhost',
      INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      INTERNAL_AUTH_CHALLENGE_TTL_SECONDS: 300,
      INTERNAL_AUTH_SESSION_TTL_SECONDS: 28_800,
      INTERNAL_ENROLLMENT_TTL_SECONDS: 900,
      INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 4).toString(
        'base64',
      ),
      SESSION_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 5).toString('base64'),
    };
    const config = {
      get: jest.fn((name: string) => values[name]),
    } as unknown as ConfigService;
    repository = {
      findEnrollmentContext: jest.fn(),
      createRegistrationCeremony: jest.fn(),
      findRegistrationCeremony: jest.fn(),
      failCeremony: jest.fn(),
      completeRegistration: jest.fn(),
      createAuthenticationCeremony: jest.fn(),
      findAuthenticationCeremony: jest.fn(),
      completeAuthentication: jest.fn(),
      createInternalUser: jest.fn(),
      createEnrollmentToken: jest.fn(),
      revokeSession: jest.fn(),
    };
    passkeys = {
      registrationOptions: jest.fn(),
      verifyRegistration: jest.fn(),
      authenticationOptions: jest.fn(),
      verifyAuthentication: jest.fn(),
    };
    enrollmentTokens = new EnrollmentTokenService(config);
    service = new PasskeyAuthService(
      config as unknown as ConfigService<AppEnvironment, true>,
      repository,
      passkeys,
      enrollmentTokens,
      new SessionTokenService(config),
    );
  });

  it('binds registration options to an active one-time enrollment', async () => {
    repository.findEnrollmentContext.mockResolvedValue({
      enrollmentTokenId,
      internalUserId: userId,
      displayName: 'Ama Administrator',
      passkeys: [],
    });
    passkeys.registrationOptions.mockResolvedValue(
      registrationOptions('registration-challenge'),
    );
    repository.createRegistrationCeremony.mockResolvedValue(ceremonyId);

    await expect(
      service.registrationOptions('A'.repeat(43), 'Work laptop'),
    ).resolves.toMatchObject({ ceremonyId });
    expect(passkeys.registrationOptions.mock.calls[0]?.[0]).toMatchObject({
      relyingPartyId: 'localhost',
      userDisplayName: 'Ama Administrator',
    });
    expect(
      repository.createRegistrationCeremony.mock.calls[0]?.[0],
    ).toMatchObject({
      challenge: 'registration-challenge',
      credentialName: 'Work laptop',
    });
  });

  it('does not reveal whether an invalid enrollment token exists', async () => {
    repository.findEnrollmentContext.mockResolvedValue(null);

    await expect(
      service.registrationOptions('A'.repeat(43), 'Work laptop'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passkeys.registrationOptions.mock.calls).toHaveLength(0);
  });

  it('counts a failed passkey registration ceremony', async () => {
    repository.findRegistrationCeremony.mockResolvedValue({
      id: ceremonyId,
      challenge: 'registration-challenge',
      credentialName: 'Work laptop',
      internalUserId: userId,
      internalUserRole: 'ADMINISTRATOR',
      enrollmentTokenId,
    });
    passkeys.verifyRegistration.mockRejectedValue(new Error('bad signature'));

    await expect(
      service.verifyRegistration(ceremonyId, {} as RegistrationResponseJSON),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.failCeremony.mock.calls).toEqual([[ceremonyId]]);
    expect(repository.completeRegistration.mock.calls).toHaveLength(0);
  });

  it('issues an opaque session only after verified user presence', async () => {
    repository.findAuthenticationCeremony.mockResolvedValue({
      id: ceremonyId,
      challenge: 'authentication-challenge',
      credential: {
        id: 'a956618f-0e61-4b87-8887-bff66f8d5fb0',
        internalUserId: userId,
        displayName: 'Ama Administrator',
        role: 'ADMINISTRATOR',
        credentialId: 'credential-id',
        publicKey: Uint8Array.from([1, 2, 3]),
        counter: 2n,
        transports: ['internal'],
      },
    });
    passkeys.verifyAuthentication.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: 'credential-id',
        newCounter: 3,
        userVerified: true,
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        origin: 'http://localhost:3001',
        rpID: 'localhost',
      },
    });
    repository.completeAuthentication.mockResolvedValue({
      sessionId: 'e202a2ec-26df-4432-b5d0-5ec87f447154',
      internalUserId: userId,
      displayName: 'Ama Administrator',
      role: 'ADMINISTRATOR',
    });

    const result = await service.verifyAuthentication(ceremonyId, {
      id: 'credential-id',
    } as AuthenticationResponseJSON);

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.user.role).toBe('ADMINISTRATOR');
    const completion = repository.completeAuthentication.mock.calls[0]?.[0];
    expect(completion?.newCounter).toBe(3);
    expect(completion?.backedUp).toBe(true);
    expect(Buffer.isBuffer(completion?.sessionFingerprint)).toBe(true);
  });
});

function registrationOptions(challenge: string) {
  return {
    challenge,
    rp: { name: 'Dashchecker Administration', id: 'localhost' },
    user: { id: 'user-id', name: 'user', displayName: 'User' },
    pubKeyCredParams: [],
    timeout: 300_000,
    attestation: 'none' as const,
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'required' as const,
      requireResidentKey: true,
      userVerification: 'required' as const,
    },
    extensions: {},
    hints: [],
  };
}

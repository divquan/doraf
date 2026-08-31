/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { ConfigService } from '@nestjs/config';
import { CloudTasksOidcVerifier } from './cloud-tasks-oidc.verifier';
import { OAuth2Client } from 'google-auth-library';

function createConfig(values: Record<string, string> = {}) {
  const store: Record<string, string> = {
    CLOUD_TASKS_AUDIENCE: 'https://api.example.com/internal/tasks/outbox',
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
      'tasks@my-project.iam.gserviceaccount.com',
    ...values,
  };
  return {
    get: (key: string) => store[key],
  } as unknown as ConfigService<any, true>;
}

function createMockClient(payloadOrError: Record<string, unknown> | Error) {
  const verifyIdToken = jest.fn(
    async ({ idToken, audience }: { idToken: string; audience: string }) => {
      if (payloadOrError instanceof Error) throw payloadOrError;
      return {
        getPayload: () => payloadOrError,
      } as any;
    },
  );
  const client = { verifyIdToken } as unknown as OAuth2Client;
  return { client, verifyIdToken };
}

describe('CloudTasksOidcVerifier', () => {
  const validPayload = {
    email: 'tasks@my-project.iam.gserviceaccount.com',
    email_verified: true,
    aud: 'https://api.example.com/internal/tasks/outbox',
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  it('throws 401 for missing token', async () => {
    const verifier = new CloudTasksOidcVerifier(
      createConfig(),
      new OAuth2Client(),
    );
    await expect(verifier.verifyAuthorizationHeader(undefined)).rejects.toThrow(
      'Missing bearer token',
    );
  });

  it('throws 401 for malformed token', async () => {
    const verifier = new CloudTasksOidcVerifier(
      createConfig(),
      new OAuth2Client(),
    );
    await expect(
      verifier.verifyAuthorizationHeader('BearerInvalid'),
    ).rejects.toThrow('Invalid bearer token');
    await expect(verifier.verifyAuthorizationHeader('Bearer ')).rejects.toThrow(
      'Invalid bearer token',
    );
  });

  it('throws 401 for expired token', async () => {
    const expiredPayload = {
      ...validPayload,
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const { client } = createMockClient(expiredPayload);
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('expired')).rejects.toThrow(
      'Token expired',
    );
  });

  it('throws 403 for wrong audience', async () => {
    const wrongAudPayload = {
      ...validPayload,
      aud: 'https://other.example.com',
    };
    const { client } = createMockClient(wrongAudPayload);
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('token')).rejects.toThrow(
      'Invalid token audience',
    );
  });

  it('throws 403 for wrong service account', async () => {
    const wrongEmailPayload = {
      ...validPayload,
      email: 'other@my-project.iam.gserviceaccount.com',
    };
    const { client } = createMockClient(wrongEmailPayload);
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('token')).rejects.toThrow(
      'Invalid token principal',
    );
  });

  it('throws 401 for invalid signature', async () => {
    const { client } = createMockClient(new Error('Invalid signature'));
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('bad')).rejects.toThrow(
      'Invalid bearer token',
    );
  });

  it('succeeds for valid token', async () => {
    const { client, verifyIdToken } = createMockClient(validPayload);
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('valid')).resolves.toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'https://api.example.com/internal/tasks/outbox',
      }),
    );
  });

  it('throws 403 when audience mismatch reported by library', async () => {
    const { client } = createMockClient(
      new Error(
        'Wrong audience: expected https://api.example.com/internal/tasks/outbox',
      ),
    );
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(verifier.verifyToken('token')).rejects.toThrow(
      'Invalid token audience',
    );
  });

  it('verifies via Authorization header', async () => {
    const { client } = createMockClient(validPayload);
    const verifier = new CloudTasksOidcVerifier(createConfig(), client);
    await expect(
      verifier.verifyAuthorizationHeader('Bearer valid-token'),
    ).resolves.toBeUndefined();
  });
});

import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://localhost:5432/doraf',
      INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
      INTERNAL_AUTH_RP_ID: 'localhost',
      INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      INTERNAL_AUTH_CHALLENGE_TTL_SECONDS: 300,
      INTERNAL_AUTH_SESSION_TTL_SECONDS: 28_800,
      INTERNAL_ENROLLMENT_TTL_SECONDS: 900,
    });
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      validateEnvironment({
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toThrow('DATABASE_URL must be a PostgreSQL connection URL');
  });

  it('rejects a WebAuthn origin with a path', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001/admin',
      }),
    ).toThrow('INTERNAL_AUTH_ORIGIN');
  });

  it('rejects an origin outside the configured relying-party domain', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'doraf.example',
        INTERNAL_AUTH_ORIGIN: 'https://attacker.example',
      }),
    ).toThrow('INTERNAL_AUTH_ORIGIN hostname');
  });
});

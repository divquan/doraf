import { validateEnvironment } from './environment';

const keyMaterial = {
  VOUCHER_MASTER_KEY_BASE64: Buffer.alloc(32, 1).toString('base64'),
  VOUCHER_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 2).toString('base64'),
  SESSION_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 3).toString('base64'),
  INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 4).toString(
    'base64',
  ),
  AGENT_PHONE_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 5).toString('base64'),
  AGENT_PHONE_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 6).toString('base64'),
  OTP_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 7).toString('base64'),
};

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        ...keyMaterial,
        PAYSTACK_SECRET_KEY: 'sk_test_environment-default',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://localhost:5432/doraf',
      ...keyMaterial,
      ORDER_CONTACT_ENCRYPTION_KEY_BASE64:
        keyMaterial.AGENT_PHONE_ENCRYPTION_KEY_BASE64,
      ORDER_CONTACT_FINGERPRINT_KEY_BASE64:
        keyMaterial.AGENT_PHONE_FINGERPRINT_KEY_BASE64,
      PAYSTACK_GUEST_EMAIL_DOMAIN: 'example.com',
      PAYSTACK_MODE: 'sandbox',
      PAYSTACK_SECRET_KEY: 'sk_test_environment-default',
      INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
      INTERNAL_AUTH_RP_ID: 'localhost',
      INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      INTERNAL_AUTH_CHALLENGE_TTL_SECONDS: 300,
      INTERNAL_AUTH_SESSION_TTL_SECONDS: 28_800,
      INTERNAL_ENROLLMENT_TTL_SECONDS: 900,
      AGENT_AUTH_OTP_TTL_SECONDS: 300,
      AGENT_AUTH_OTP_MAX_ATTEMPTS: 5,
      AGENT_AUTH_REGISTRATION_TTL_SECONDS: 900,
      AGENT_AUTH_SESSION_TTL_SECONDS: 2_592_000,
    });
  });

  it('requires a test key in Paystack sandbox mode', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        ...keyMaterial,
        PAYSTACK_MODE: 'sandbox',
        PAYSTACK_SECRET_KEY: 'sk_live_wrong-environment',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toThrow('sk_test_');
  });

  it('requires a sandbox key when Paystack mode is omitted in development', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        ...keyMaterial,
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toThrow('PAYSTACK_SECRET_KEY is required');
  });

  it('rejects a localhost Paystack guest email domain', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        ...keyMaterial,
        PAYSTACK_SECRET_KEY: 'sk_test_environment-email-domain',
        PAYSTACK_GUEST_EMAIL_DOMAIN: 'guest.localhost',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toThrow('valid non-localhost email domain');
  });

  it('does not allow live payment mode outside production', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
        ...keyMaterial,
        PAYSTACK_MODE: 'live',
        PAYSTACK_SECRET_KEY: 'sk_live_example',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'localhost',
        INTERNAL_AUTH_ORIGIN: 'http://localhost:3001',
      }),
    ).toThrow('only allowed in production');
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
        ...keyMaterial,
        PAYSTACK_SECRET_KEY: 'sk_test_environment-origin-domain',
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
        ...keyMaterial,
        PAYSTACK_SECRET_KEY: 'sk_test_environment-origin-domain',
        INTERNAL_AUTH_RP_NAME: 'Doraf Administration',
        INTERNAL_AUTH_RP_ID: 'doraf.example',
        INTERNAL_AUTH_ORIGIN: 'https://attacker.example',
      }),
    ).toThrow('INTERNAL_AUTH_ORIGIN hostname');
  });
});

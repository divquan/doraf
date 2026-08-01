export type NodeEnvironment = 'development' | 'production' | 'test';

export interface AppEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
  VOUCHER_MASTER_KEY_BASE64: string;
  VOUCHER_FINGERPRINT_KEY_BASE64: string;
  SESSION_FINGERPRINT_KEY_BASE64: string;
  INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64: string;
  AGENT_PHONE_ENCRYPTION_KEY_BASE64: string;
  AGENT_PHONE_FINGERPRINT_KEY_BASE64: string;
  ORDER_CONTACT_ENCRYPTION_KEY_BASE64: string;
  ORDER_CONTACT_FINGERPRINT_KEY_BASE64: string;
  PAYSTACK_GUEST_EMAIL_DOMAIN: string;
  OTP_FINGERPRINT_KEY_BASE64: string;
  AGENT_AUTH_OTP_TTL_SECONDS: number;
  AGENT_AUTH_OTP_MAX_ATTEMPTS: number;
  AGENT_AUTH_REGISTRATION_TTL_SECONDS: number;
  AGENT_AUTH_SESSION_TTL_SECONDS: number;
  INTERNAL_AUTH_RP_NAME: string;
  INTERNAL_AUTH_RP_ID: string;
  INTERNAL_AUTH_ORIGIN: string;
  INTERNAL_AUTH_CHALLENGE_TTL_SECONDS: number;
  INTERNAL_AUTH_SESSION_TTL_SECONDS: number;
  INTERNAL_ENROLLMENT_TTL_SECONDS: number;
}

const nodeEnvironments = new Set<NodeEnvironment>([
  'development',
  'production',
  'test',
]);

export function validateEnvironment(
  raw: Record<string, unknown>,
): AppEnvironment {
  const nodeEnvironment = raw.NODE_ENV ?? 'development';
  if (
    typeof nodeEnvironment !== 'string' ||
    !nodeEnvironments.has(nodeEnvironment as NodeEnvironment)
  ) {
    throw new Error('NODE_ENV must be development, production, or test');
  }

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = raw.DATABASE_URL;
  if (
    typeof databaseUrl !== 'string' ||
    !databaseUrl.startsWith('postgresql://')
  ) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }

  const voucherMasterKey = requiredBase64Key(
    raw.VOUCHER_MASTER_KEY_BASE64,
    'VOUCHER_MASTER_KEY_BASE64',
    32,
    true,
  );
  const voucherFingerprintKey = requiredBase64Key(
    raw.VOUCHER_FINGERPRINT_KEY_BASE64,
    'VOUCHER_FINGERPRINT_KEY_BASE64',
    32,
    false,
  );
  const sessionFingerprintKey = requiredBase64Key(
    raw.SESSION_FINGERPRINT_KEY_BASE64,
    'SESSION_FINGERPRINT_KEY_BASE64',
    32,
    false,
  );
  const enrollmentFingerprintKey = requiredBase64Key(
    raw.INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64,
    'INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64',
    32,
    false,
  );
  const agentPhoneEncryptionKey = requiredBase64Key(
    raw.AGENT_PHONE_ENCRYPTION_KEY_BASE64,
    'AGENT_PHONE_ENCRYPTION_KEY_BASE64',
    32,
    true,
  );
  const agentPhoneFingerprintKey = requiredBase64Key(
    raw.AGENT_PHONE_FINGERPRINT_KEY_BASE64,
    'AGENT_PHONE_FINGERPRINT_KEY_BASE64',
    32,
    false,
  );
  const otpFingerprintKey = requiredBase64Key(
    raw.OTP_FINGERPRINT_KEY_BASE64,
    'OTP_FINGERPRINT_KEY_BASE64',
    32,
    false,
  );
  const orderContactEncryptionKey = optionalDevelopmentKey(
    raw.ORDER_CONTACT_ENCRYPTION_KEY_BASE64,
    agentPhoneEncryptionKey,
    'ORDER_CONTACT_ENCRYPTION_KEY_BASE64',
    nodeEnvironment as NodeEnvironment,
    true,
  );
  const orderContactFingerprintKey = optionalDevelopmentKey(
    raw.ORDER_CONTACT_FINGERPRINT_KEY_BASE64,
    agentPhoneFingerprintKey,
    'ORDER_CONTACT_FINGERPRINT_KEY_BASE64',
    nodeEnvironment as NodeEnvironment,
    false,
  );
  const guestEmailDomain = optionalDevelopmentString(
    raw.PAYSTACK_GUEST_EMAIL_DOMAIN,
    'guest.localhost',
    'PAYSTACK_GUEST_EMAIL_DOMAIN',
    nodeEnvironment as NodeEnvironment,
  ).toLowerCase();
  if (!isValidHostname(guestEmailDomain)) {
    throw new Error('PAYSTACK_GUEST_EMAIL_DOMAIN must be a hostname');
  }

  const relyingPartyName = requiredString(
    raw.INTERNAL_AUTH_RP_NAME,
    'INTERNAL_AUTH_RP_NAME',
  );
  const relyingPartyId = requiredString(
    raw.INTERNAL_AUTH_RP_ID,
    'INTERNAL_AUTH_RP_ID',
  );
  if (!isValidRelyingPartyId(relyingPartyId)) {
    throw new Error('INTERNAL_AUTH_RP_ID must be a hostname without a scheme');
  }
  const origin = requiredString(
    raw.INTERNAL_AUTH_ORIGIN,
    'INTERNAL_AUTH_ORIGIN',
  );
  if (!isValidWebAuthnOrigin(origin)) {
    throw new Error(
      'INTERNAL_AUTH_ORIGIN must be an HTTP localhost or HTTPS origin without a path',
    );
  }
  if (!originMatchesRelyingParty(origin, relyingPartyId)) {
    throw new Error(
      'INTERNAL_AUTH_ORIGIN hostname must equal or be a subdomain of INTERNAL_AUTH_RP_ID',
    );
  }

  const challengeTtlSeconds = positiveInteger(
    raw.INTERNAL_AUTH_CHALLENGE_TTL_SECONDS ?? 300,
    'INTERNAL_AUTH_CHALLENGE_TTL_SECONDS',
  );
  const sessionTtlSeconds = positiveInteger(
    raw.INTERNAL_AUTH_SESSION_TTL_SECONDS ?? 28_800,
    'INTERNAL_AUTH_SESSION_TTL_SECONDS',
  );
  const enrollmentTtlSeconds = positiveInteger(
    raw.INTERNAL_ENROLLMENT_TTL_SECONDS ?? 900,
    'INTERNAL_ENROLLMENT_TTL_SECONDS',
  );
  const agentOtpTtlSeconds = positiveInteger(
    raw.AGENT_AUTH_OTP_TTL_SECONDS ?? 300,
    'AGENT_AUTH_OTP_TTL_SECONDS',
  );
  const agentOtpMaxAttempts = positiveInteger(
    raw.AGENT_AUTH_OTP_MAX_ATTEMPTS ?? 5,
    'AGENT_AUTH_OTP_MAX_ATTEMPTS',
  );
  const agentRegistrationTtlSeconds = positiveInteger(
    raw.AGENT_AUTH_REGISTRATION_TTL_SECONDS ?? 900,
    'AGENT_AUTH_REGISTRATION_TTL_SECONDS',
  );
  const agentSessionTtlSeconds = positiveInteger(
    raw.AGENT_AUTH_SESSION_TTL_SECONDS ?? 2_592_000,
    'AGENT_AUTH_SESSION_TTL_SECONDS',
  );

  return {
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl,
    VOUCHER_MASTER_KEY_BASE64: voucherMasterKey,
    VOUCHER_FINGERPRINT_KEY_BASE64: voucherFingerprintKey,
    SESSION_FINGERPRINT_KEY_BASE64: sessionFingerprintKey,
    INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64: enrollmentFingerprintKey,
    AGENT_PHONE_ENCRYPTION_KEY_BASE64: agentPhoneEncryptionKey,
    AGENT_PHONE_FINGERPRINT_KEY_BASE64: agentPhoneFingerprintKey,
    OTP_FINGERPRINT_KEY_BASE64: otpFingerprintKey,
    ORDER_CONTACT_ENCRYPTION_KEY_BASE64: orderContactEncryptionKey,
    ORDER_CONTACT_FINGERPRINT_KEY_BASE64: orderContactFingerprintKey,
    PAYSTACK_GUEST_EMAIL_DOMAIN: guestEmailDomain,
    AGENT_AUTH_OTP_TTL_SECONDS: agentOtpTtlSeconds,
    AGENT_AUTH_OTP_MAX_ATTEMPTS: agentOtpMaxAttempts,
    AGENT_AUTH_REGISTRATION_TTL_SECONDS: agentRegistrationTtlSeconds,
    AGENT_AUTH_SESSION_TTL_SECONDS: agentSessionTtlSeconds,
    INTERNAL_AUTH_RP_NAME: relyingPartyName,
    INTERNAL_AUTH_RP_ID: relyingPartyId,
    INTERNAL_AUTH_ORIGIN: origin,
    INTERNAL_AUTH_CHALLENGE_TTL_SECONDS: challengeTtlSeconds,
    INTERNAL_AUTH_SESSION_TTL_SECONDS: sessionTtlSeconds,
    INTERNAL_ENROLLMENT_TTL_SECONDS: enrollmentTtlSeconds,
  };
}

function optionalDevelopmentKey(
  value: unknown,
  developmentFallback: string,
  name: string,
  environment: NodeEnvironment,
  exact: boolean,
): string {
  if (value === undefined && environment !== 'production') {
    return developmentFallback;
  }
  return requiredBase64Key(value, name, 32, exact);
}

function optionalDevelopmentString(
  value: unknown,
  developmentFallback: string,
  name: string,
  environment: NodeEnvironment,
): string {
  if (value === undefined && environment !== 'production') {
    return developmentFallback;
  }
  return requiredString(value, name);
}

function requiredBase64Key(
  value: unknown,
  name: string,
  minimumBytes: number,
  exact: boolean,
): string {
  const encoded = requiredString(value, name);
  const decoded = Buffer.from(encoded, 'base64');
  if (
    decoded.length < minimumBytes ||
    (exact && decoded.length !== minimumBytes)
  ) {
    throw new Error(
      exact
        ? `${name} must contain exactly ${minimumBytes} bytes in base64`
        : `${name} must contain at least ${minimumBytes} bytes in base64`,
    );
  }
  return encoded;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function isValidRelyingPartyId(value: string): boolean {
  if (value === 'localhost') {
    return true;
  }
  return (
    value.length <= 253 &&
    value
      .split('.')
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

function isValidHostname(value: string): boolean {
  if (value === 'localhost' || value.endsWith('.localhost')) return true;
  return (
    value.length <= 253 &&
    value.includes('.') &&
    value
      .split('.')
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

function originMatchesRelyingParty(origin: string, relyingPartyId: string) {
  const hostname = new URL(origin).hostname;
  return hostname === relyingPartyId || hostname.endsWith(`.${relyingPartyId}`);
}

function isValidWebAuthnOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return (
      (url.protocol === 'https:' || isLocalHttp) &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      value === url.origin
    );
  } catch {
    return false;
  }
}

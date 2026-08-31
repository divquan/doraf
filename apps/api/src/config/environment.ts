export type NodeEnvironment = 'development' | 'production' | 'test';
export type PaymentProviderMode = 'sandbox' | 'live';
export type WorkerExecution = 'continuous' | 'run-once';

export interface AppEnvironment {
  NODE_ENV: NodeEnvironment;
  WORKER_ENABLED: boolean;
  WORKER_EXECUTION: WorkerExecution;
  CLOUD_TASKS_PROJECT_ID: string;
  CLOUD_TASKS_LOCATION: string;
  CLOUD_TASKS_QUEUE: string;
  CLOUD_TASKS_TARGET_URL: string;
  CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: string;
  CLOUD_TASKS_AUDIENCE: string;
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
  PAYSTACK_MODE: PaymentProviderMode;
  PAYSTACK_SECRET_KEY: string;
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

  const cloudTasksProjectId = cloudTasksProjectIdEnvironment(
    raw.CLOUD_TASKS_PROJECT_ID,
    nodeEnvironment as NodeEnvironment,
  );
  const cloudTasksLocation = cloudTasksLocationEnvironment(
    raw.CLOUD_TASKS_LOCATION,
    nodeEnvironment as NodeEnvironment,
  );
  const cloudTasksQueue = cloudTasksQueueEnvironment(
    raw.CLOUD_TASKS_QUEUE,
    nodeEnvironment as NodeEnvironment,
  );
  const cloudTasksTargetUrl = cloudTasksTargetUrlEnvironment(
    raw.CLOUD_TASKS_TARGET_URL,
    nodeEnvironment as NodeEnvironment,
  );
  const cloudTasksServiceAccountEmail =
    cloudTasksServiceAccountEmailEnvironment(
      raw.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL,
      nodeEnvironment as NodeEnvironment,
    );
  const cloudTasksAudience = cloudTasksAudienceEnvironment(
    raw.CLOUD_TASKS_AUDIENCE,
    nodeEnvironment as NodeEnvironment,
  );

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
    'example.com',
    'PAYSTACK_GUEST_EMAIL_DOMAIN',
    nodeEnvironment as NodeEnvironment,
  ).toLowerCase();
  if (!isValidPaystackEmailDomain(guestEmailDomain)) {
    throw new Error(
      'PAYSTACK_GUEST_EMAIL_DOMAIN must be a valid non-localhost email domain',
    );
  }
  const paystackMode = paymentProviderMode(
    raw.PAYSTACK_MODE,
    nodeEnvironment as NodeEnvironment,
  );
  const paystackSecretKey = paymentProviderSecret(
    raw.PAYSTACK_SECRET_KEY,
    paystackMode,
    nodeEnvironment as NodeEnvironment,
  );

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
    WORKER_ENABLED: booleanEnvironment(raw.WORKER_ENABLED, false),
    WORKER_EXECUTION: workerExecutionEnvironment(raw.WORKER_EXECUTION),
    CLOUD_TASKS_PROJECT_ID: cloudTasksProjectId,
    CLOUD_TASKS_LOCATION: cloudTasksLocation,
    CLOUD_TASKS_QUEUE: cloudTasksQueue,
    CLOUD_TASKS_TARGET_URL: cloudTasksTargetUrl,
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: cloudTasksServiceAccountEmail,
    CLOUD_TASKS_AUDIENCE: cloudTasksAudience,
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
    PAYSTACK_MODE: paystackMode,
    PAYSTACK_SECRET_KEY: paystackSecretKey,
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

function booleanEnvironment(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('WORKER_ENABLED must be true or false');
}

function workerExecutionEnvironment(value: unknown): WorkerExecution {
  const execution = value ?? 'continuous';
  if (execution !== 'continuous' && execution !== 'run-once') {
    throw new Error('WORKER_EXECUTION must be continuous or run-once');
  }
  return execution;
}

function cloudTasksProjectIdEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_PROJECT_ID is required');
    return 'test-project';
  }
  const projectId = requiredString(value, 'CLOUD_TASKS_PROJECT_ID');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error(
      'CLOUD_TASKS_PROJECT_ID must be 6-30 lowercase letters, digits or hyphens',
    );
  }
  return projectId;
}

function cloudTasksLocationEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_LOCATION is required');
    return 'us-central1';
  }
  const location = requiredString(value, 'CLOUD_TASKS_LOCATION');
  if (!/^[a-z0-9-]+$/.test(location)) {
    throw new Error(
      'CLOUD_TASKS_LOCATION must contain only lowercase letters, digits or hyphens',
    );
  }
  return location;
}

function cloudTasksQueueEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_QUEUE is required');
    return 'outbox';
  }
  const queue = requiredString(value, 'CLOUD_TASKS_QUEUE');
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(queue)) {
    throw new Error(
      'CLOUD_TASKS_QUEUE must start with a letter and contain only letters, digits, hyphens or underscores',
    );
  }
  return queue;
}

function cloudTasksTargetUrlEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_TARGET_URL is required');
    return 'http://localhost:3000/api/outbox/tasks';
  }
  const url = requiredString(value, 'CLOUD_TASKS_TARGET_URL');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('CLOUD_TASKS_TARGET_URL must be a valid URL');
  }
  if (environment === 'production' && parsed.protocol !== 'https:') {
    throw new Error('CLOUD_TASKS_TARGET_URL must be an https:// URL in production');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('CLOUD_TASKS_TARGET_URL must be an https:// or http:// URL');
  }
  return url;
}

function cloudTasksServiceAccountEmailEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL is required');
    return 'test@test-project.iam.gserviceaccount.com';
  }
  const email = requiredString(
    value,
    'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL',
  );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL must be a valid email');
  }
  if (!email.endsWith('.iam.gserviceaccount.com')) {
    throw new Error(
      'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL must be a *.iam.gserviceaccount.com address',
    );
  }
  return email;
}

function cloudTasksAudienceEnvironment(
  value: unknown,
  environment: NodeEnvironment,
): string {
  if (value === undefined) {
    if (environment === 'production')
      throw new Error('CLOUD_TASKS_AUDIENCE is required');
    return 'http://localhost:3000/api/outbox/tasks';
  }
  const audience = requiredString(value, 'CLOUD_TASKS_AUDIENCE');
  if (audience.includes('://')) {
    try {
      new URL(audience);
    } catch {
      throw new Error('CLOUD_TASKS_AUDIENCE must be a valid URL when it contains ://');
    }
  }
  return audience;
}

function paymentProviderMode(
  value: unknown,
  environment: NodeEnvironment,
): PaymentProviderMode {
  if (value === undefined && environment !== 'production') return 'sandbox';
  if (value !== 'sandbox' && value !== 'live') {
    throw new Error('PAYSTACK_MODE must be sandbox or live');
  }
  if (environment === 'production' && value !== 'live') {
    throw new Error('Production requires PAYSTACK_MODE=live');
  }
  if (environment !== 'production' && value === 'live') {
    throw new Error('PAYSTACK_MODE=live is only allowed in production');
  }
  return value;
}

function paymentProviderSecret(
  value: unknown,
  mode: PaymentProviderMode,
  environment: NodeEnvironment,
): string {
  const secret = requiredString(value, 'PAYSTACK_SECRET_KEY');
  if (mode === 'sandbox' && !secret.startsWith('sk_test_')) {
    throw new Error('Paystack sandbox requires an sk_test_ secret key');
  }
  if (
    mode === 'live' &&
    (environment !== 'production' || !secret.startsWith('sk_live_'))
  ) {
    throw new Error('Paystack live mode requires an sk_live_ production key');
  }
  return secret;
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

function isValidPaystackEmailDomain(value: string): boolean {
  return (
    isValidHostname(value) &&
    value !== 'localhost' &&
    !value.endsWith('.localhost')
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

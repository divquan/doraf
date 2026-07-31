process.env.DATABASE_URL ??= 'postgresql://localhost:5432/doraf_test';
process.env.VOUCHER_KMS_KEY_NAME ??=
  'projects/test/locations/global/keyRings/test/cryptoKeys/vouchers';
process.env.VOUCHER_FINGERPRINT_KEY_BASE64 ??= Buffer.alloc(32, 7).toString(
  'base64',
);
process.env.SESSION_FINGERPRINT_KEY_BASE64 ??= Buffer.alloc(32, 8).toString(
  'base64',
);
process.env.INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64 ??= Buffer.alloc(
  32,
  9,
).toString('base64');
process.env.INTERNAL_AUTH_RP_NAME ??= 'Doraf Administration';
process.env.INTERNAL_AUTH_RP_ID ??= 'localhost';
process.env.INTERNAL_AUTH_ORIGIN ??= 'http://localhost:3001';
process.env.INTERNAL_AUTH_CHALLENGE_TTL_SECONDS ??= '300';
process.env.INTERNAL_AUTH_SESSION_TTL_SECONDS ??= '28800';
process.env.INTERNAL_ENROLLMENT_TTL_SECONDS ??= '900';

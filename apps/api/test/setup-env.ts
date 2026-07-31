process.env.DATABASE_URL ??= 'postgresql://localhost:5432/doraf_test';
process.env.VOUCHER_KMS_KEY_NAME ??=
  'projects/test/locations/global/keyRings/test/cryptoKeys/vouchers';
process.env.VOUCHER_FINGERPRINT_KEY_BASE64 ??= Buffer.alloc(32, 7).toString(
  'base64',
);
process.env.SESSION_FINGERPRINT_KEY_BASE64 ??= Buffer.alloc(32, 8).toString(
  'base64',
);

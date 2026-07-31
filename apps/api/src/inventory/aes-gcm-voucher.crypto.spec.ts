import { createDecipheriv } from 'node:crypto';
import { AesGcmVoucherCrypto } from './aes-gcm-voucher.crypto';
import type { VoucherKeyProvider } from './inventory.types';

describe('AesGcmVoucherCrypto', () => {
  const dataKey = Buffer.alloc(32, 7);
  const keyProvider: VoucherKeyProvider = {
    createBatchKey: jest.fn().mockResolvedValue({
      plaintextKey: Buffer.from(dataKey),
      encryptedDataKey: Buffer.from('wrapped-key'),
      kmsKeyVersion:
        'projects/test/locations/global/keyRings/test/cryptoKeys/voucher/cryptoKeyVersions/1',
      cryptoVersion: 1,
    }),
  };
  const crypto = new AesGcmVoucherCrypto(keyProvider, Buffer.alloc(32, 9));

  it('encrypts and authenticates a leading-zero PIN', () => {
    const context = 'doraf:test:pin:v1';
    const encrypted = crypto.encrypt('012345678912', dataKey, context);
    const decipher = createDecipheriv('aes-256-gcm', dataKey, encrypted.nonce);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(encrypted.authTag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]).toString('utf8');

    expect(plaintext).toBe('012345678912');
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('012345678912');
  });

  it('uses domain-separated deterministic HMAC fingerprints', () => {
    expect(crypto.fingerprintSerial('abc123')).toEqual(
      crypto.fingerprintSerial('ABC123'),
    );
    expect(crypto.fingerprintSerial('ABC123')).not.toEqual(
      crypto.fingerprintPin('ABC123'),
    );
  });
});

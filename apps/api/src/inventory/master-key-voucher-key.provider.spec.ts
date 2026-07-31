import { createDecipheriv } from 'node:crypto';
import { MasterKeyVoucherKeyProvider } from './master-key-voucher-key.provider';

describe('MasterKeyVoucherKeyProvider', () => {
  it('wraps a random batch key without persisting it in plaintext', async () => {
    const masterKey = Buffer.alloc(32, 1);
    const provider = new MasterKeyVoucherKeyProvider(masterKey);

    const batchKey = await provider.createBatchKey();
    const nonce = batchKey.encryptedDataKey.subarray(0, 12);
    const authTag = batchKey.encryptedDataKey.subarray(12, 28);
    const ciphertext = batchKey.encryptedDataKey.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAAD(Buffer.from('doraf:voucher-batch-key:v1', 'utf8'));
    decipher.setAuthTag(authTag);
    const recovered = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    expect(recovered).toEqual(batchKey.plaintextKey);
    expect(batchKey.encryptedDataKey).not.toEqual(batchKey.plaintextKey);
    expect(batchKey.kmsKeyVersion).toBe('master-key:v1');
  });

  it('requires a 32-byte master key', () => {
    expect(() => new MasterKeyVoucherKeyProvider(Buffer.alloc(31))).toThrow(
      'Voucher master key must contain exactly 32 bytes',
    );
  });
});

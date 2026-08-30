import { createCipheriv, randomBytes } from 'node:crypto';
import type { BatchDataKey, VoucherKeyProvider } from './inventory.types';

/**
 * Development and MVP key wrapper. The master key is injected as a runtime
 * secret and is never written to the database. The encoded batch key is
 * nonce || authentication tag || ciphertext.
 */
export class MasterKeyVoucherKeyProvider implements VoucherKeyProvider {
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error('Voucher master key must contain exactly 32 bytes');
    }
  }

  createBatchKey(): Promise<BatchDataKey> {
    const plaintextKey = randomBytes(32);
    const nonce = randomBytes(12);

    try {
      const cipher = createCipheriv('aes-256-gcm', this.masterKey, nonce);
      cipher.setAAD(Buffer.from('dashchecker:voucher-batch-key:v1', 'utf8'));
      const ciphertext = Buffer.concat([
        cipher.update(plaintextKey),
        cipher.final(),
      ]);
      return Promise.resolve({
        plaintextKey,
        encryptedDataKey: Buffer.concat([
          nonce,
          cipher.getAuthTag(),
          ciphertext,
        ]),
        kmsKeyVersion: 'master-key:v1',
        cryptoVersion: 1,
      });
    } catch (error: unknown) {
      plaintextKey.fill(0);
      return Promise.reject(
        error instanceof Error
          ? error
          : new Error('Voucher batch key wrapping failed'),
      );
    }
  }
}

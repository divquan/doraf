import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import type {
  BatchDataKey,
  EncryptedValue,
  VoucherCrypto,
  VoucherKeyProvider,
} from './inventory.types';
import { normalizeSerial } from './csv-inventory.parser';

export class AesGcmVoucherCrypto implements VoucherCrypto {
  constructor(
    private readonly keyProvider: VoucherKeyProvider,
    private readonly fingerprintKey: Buffer,
  ) {
    if (fingerprintKey.length < 32) {
      throw new Error('Voucher fingerprint key must be at least 32 bytes');
    }
  }

  createBatchKey(): Promise<BatchDataKey> {
    return this.keyProvider.createBatchKey();
  }

  fingerprintSerial(serialNumber: string): Buffer {
    return this.fingerprint('serial', normalizeSerial(serialNumber));
  }

  fingerprintPin(pin: string): Buffer {
    return this.fingerprint('pin', pin);
  }

  encrypt(
    value: string,
    plaintextKey: Buffer,
    context: string,
  ): EncryptedValue {
    if (plaintextKey.length !== 32) {
      throw new Error('Voucher data key must contain exactly 32 bytes');
    }

    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', plaintextKey, nonce);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext,
      nonce,
      authTag: cipher.getAuthTag(),
    };
  }

  private fingerprint(type: 'serial' | 'pin', value: string): Buffer {
    return createHmac('sha256', this.fingerprintKey)
      .update(`doraf:voucher:${type}:v1\0`, 'utf8')
      .update(value, 'utf8')
      .digest();
  }
}

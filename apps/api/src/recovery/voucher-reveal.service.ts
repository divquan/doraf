import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';

interface ProtectedVoucher {
  id: string;
  productId: string;
  batchId: string;
  cryptoVersion: number;
  serialCiphertext: Uint8Array;
  serialNonce: Uint8Array;
  serialAuthTag: Uint8Array;
  pinCiphertext: Uint8Array;
  pinNonce: Uint8Array;
  pinAuthTag: Uint8Array;
  batch: { encryptedDataKey: Uint8Array };
}

@Injectable()
export class VoucherRevealService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.masterKey = Buffer.from(
      config.getOrThrow<string>('VOUCHER_MASTER_KEY_BASE64'),
      'base64',
    );
  }

  reveal(voucher: ProtectedVoucher) {
    const dataKey = this.unwrap(voucher.batch.encryptedDataKey);
    try {
      return {
        serialNumber: this.decrypt(
          voucher.serialCiphertext,
          voucher.serialNonce,
          voucher.serialAuthTag,
          dataKey,
          this.context(voucher, 'serial'),
        ),
        pin: this.decrypt(
          voucher.pinCiphertext,
          voucher.pinNonce,
          voucher.pinAuthTag,
          dataKey,
          this.context(voucher, 'pin'),
        ),
      };
    } finally {
      dataKey.fill(0);
    }
  }

  private unwrap(value: Uint8Array) {
    const protectedKey = Buffer.from(value);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.masterKey,
      protectedKey.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from('doraf:voucher-batch-key:v1', 'utf8'));
    decipher.setAuthTag(protectedKey.subarray(12, 28));
    return Buffer.concat([
      decipher.update(protectedKey.subarray(28)),
      decipher.final(),
    ]);
  }

  private decrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    authTag: Uint8Array,
    key: Buffer,
    context: string,
  ) {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(authTag));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext)),
      decipher.final(),
    ]).toString('utf8');
  }

  private context(voucher: ProtectedVoucher, field: 'serial' | 'pin') {
    return `doraf:voucher:${voucher.id}:${voucher.productId}:${voucher.batchId}:${field}:v${voucher.cryptoVersion}`;
  }
}

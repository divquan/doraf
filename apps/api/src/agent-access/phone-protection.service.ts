import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import type { ProtectedPhone } from './agent-access.types';

const aad = Buffer.from('doraf:agent-phone:v1', 'utf8');

@Injectable()
export class PhoneProtectionService {
  private readonly encryptionKey: Buffer;
  private readonly fingerprintKey: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>('AGENT_PHONE_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('AGENT_PHONE_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
  }

  protect(value: string): ProtectedPhone {
    const normalized = this.normalize(value);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    const authenticationTag = cipher.getAuthTag();

    return {
      normalized,
      ciphertext: Buffer.concat([nonce, authenticationTag, encrypted]),
      fingerprint: this.fingerprint(normalized),
      mask: `+233 •• ••• ${normalized.slice(-4)}`,
      encryptionKeyId: 'master-key:v1',
      formatVersion: 1,
    };
  }

  decrypt(ciphertext: Uint8Array): string {
    const value = Buffer.from(ciphertext);
    if (value.length <= 28) {
      throw new BadRequestException('Stored phone number is invalid');
    }
    const nonce = value.subarray(0, 12);
    const authenticationTag = value.subarray(12, 28);
    const encrypted = value.subarray(28);
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        nonce,
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(authenticationTag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException('Stored phone number cannot be decrypted');
    }
  }

  fingerprint(normalized: string): Buffer {
    return createHmac('sha256', this.fingerprintKey)
      .update('doraf:agent-phone:v1\0', 'utf8')
      .update(normalized, 'utf8')
      .digest();
  }

  normalize(value: string): string {
    const digits = value.replace(/[^0-9]/g, '');
    const normalized = digits.startsWith('0')
      ? `233${digits.slice(1)}`
      : digits;

    if (!/^233\d{9}$/.test(normalized)) {
      throw new BadRequestException('Enter a valid Ghana phone number');
    }
    return normalized;
  }
}

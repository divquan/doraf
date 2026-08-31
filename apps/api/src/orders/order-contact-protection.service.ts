import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import type { AppEnvironment } from '../config/environment';

export interface ProtectedContact {
  normalized: string;
  ciphertext: Buffer;
  fingerprint: Buffer;
  mask: string;
  encryptionKeyId: string;
  formatVersion: number;
}

@Injectable()
export class OrderContactProtectionService {
  private readonly encryptionKey: Buffer;
  private readonly fingerprintKey: Buffer;
  private readonly guestEmailDomain: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>('ORDER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('ORDER_CONTACT_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
    this.guestEmailDomain = config.get('PAYSTACK_GUEST_EMAIL_DOMAIN', {
      infer: true,
    });
  }

  protectPhone(value: string, purpose: 'delivery' | 'payer'): ProtectedContact {
    const normalized = normalizeGhanaPhone(value);
    return this.protect(
      normalized,
      `phone:${purpose}`,
      `+233 •• ••• ${normalized.slice(-4)}`,
    );
  }

  protectEmail(
    value: string,
    purpose: 'delivery' | 'synthetic',
  ): ProtectedContact {
    const normalized = normalizeEmail(value);
    const [local, domain] = normalized.split('@') as [string, string];
    const mask = `${local.slice(0, 1)}${'•'.repeat(Math.min(4, Math.max(2, local.length - 1)))}@${domain}`;
    return this.protect(normalized, `email:${purpose}`, mask);
  }

  syntheticEmail(normalizedPayerPhone: string): ProtectedContact {
    return this.protectEmail(
      `${normalizedPayerPhone}@${this.guestEmailDomain}`,
      'synthetic',
    );
  }

  normalizePhone(value: string): string {
    return normalizeGhanaPhone(value);
  }

  normalizeEmail(value: string): string {
    return normalizeEmail(value);
  }

  revealPhone(ciphertext: Uint8Array, purpose: 'delivery' | 'payer'): string {
    return this.reveal(ciphertext, `phone:${purpose}`);
  }

  revealEmail(
    ciphertext: Uint8Array,
    purpose: 'delivery' | 'synthetic',
  ): string {
    return this.reveal(ciphertext, `email:${purpose}`);
  }

  private protect(
    normalized: string,
    purpose: string,
    mask: string,
  ): ProtectedContact {
    const nonce = randomBytes(12);
    const aad = Buffer.from(`dashchecker:order-contact:${purpose}:v1`, 'utf8');
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    return {
      normalized,
      ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]),
      fingerprint: createHmac('sha256', this.fingerprintKey)
        .update(`dashchecker:order-contact:${purpose}:v1\0`, 'utf8')
        .update(normalized, 'utf8')
        .digest(),
      mask,
      encryptionKeyId: 'order-contact-master-key:v1',
      formatVersion: 1,
    };
  }

  private reveal(ciphertext: Uint8Array, purpose: string): string {
    const protectedValue = Buffer.from(ciphertext);
    if (protectedValue.length < 29) {
      throw new Error('Protected order contact is malformed');
    }
    const nonce = protectedValue.subarray(0, 12);
    const authTag = protectedValue.subarray(12, 28);
    const encrypted = protectedValue.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, nonce);
    decipher.setAAD(
      Buffer.from(`dashchecker:order-contact:${purpose}:v1`, 'utf8'),
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}

function normalizeGhanaPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  const normalized = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  if (!/^233\d{9}$/.test(normalized)) {
    throw new BadRequestException('Enter a valid Ghana phone number');
  }
  return normalized;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new BadRequestException('Enter a valid email address');
  }
  return normalized;
}

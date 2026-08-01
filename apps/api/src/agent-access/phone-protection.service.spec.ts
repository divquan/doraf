import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type { AppEnvironment } from '../config/environment';
import { PhoneProtectionService } from './phone-protection.service';

describe('PhoneProtectionService', () => {
  const service = new PhoneProtectionService(
    new ConfigService<Partial<AppEnvironment>, true>({
      AGENT_PHONE_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 1).toString('base64'),
      AGENT_PHONE_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 2).toString(
        'base64',
      ),
    }),
  );

  it('normalizes local and international Ghana numbers consistently', () => {
    expect(service.normalize('024 123 4567')).toBe('233241234567');
    expect(service.normalize('+233 24 123 4567')).toBe('233241234567');
  });

  it('encrypts randomized ciphertext while keeping lookup fingerprints stable', () => {
    const first = service.protect('0241234567');
    const second = service.protect('+233241234567');

    expect(first.fingerprint).toEqual(second.fingerprint);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
    expect(first.mask).toBe('+233 •• ••• 4567');
    expect(first.ciphertext.toString()).not.toContain('233241234567');
  });

  it('rejects numbers outside the supported Ghana format', () => {
    expect(() => service.normalize('12345')).toThrow(BadRequestException);
  });
});

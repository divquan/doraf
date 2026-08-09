import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import type { AppEnvironment } from '../config/environment';

@Injectable()
export class OtpTokenService {
  private readonly fingerprintKey: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('OTP_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
  }

  createCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  codeFingerprint(challengeId: string, code: string): Buffer {
    return this.fingerprint(
      'dashchecker:agent-otp:v1',
      `${challengeId}\0${code}`,
    );
  }

  codeMatches(
    challengeId: string,
    code: string,
    expected: Uint8Array,
  ): boolean {
    const actual = this.codeFingerprint(challengeId, code);
    const expectedBuffer = Buffer.from(expected);
    return (
      actual.length === expectedBuffer.length &&
      timingSafeEqual(actual, expectedBuffer)
    );
  }

  createCompletionToken(): { token: string; fingerprint: Buffer } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      fingerprint: this.completionFingerprint(token),
    };
  }

  completionFingerprint(token: string): Buffer {
    return this.fingerprint('dashchecker:agent-registration:v1', token);
  }

  private fingerprint(domain: string, value: string): Buffer {
    return createHmac('sha256', this.fingerprintKey)
      .update(`${domain}\0`, 'utf8')
      .update(value, 'utf8')
      .digest();
  }
}

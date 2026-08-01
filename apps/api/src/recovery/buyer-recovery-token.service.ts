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
export class BuyerRecoveryTokenService {
  private readonly key: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.key = Buffer.from(
      config.getOrThrow<string>('OTP_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
  }

  createCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  codeFingerprint(challengeId: string, code: string) {
    return this.fingerprint(
      'doraf:buyer-recovery-code:v1',
      `${challengeId}\0${code}`,
    );
  }

  codeMatches(challengeId: string, code: string, expected: Uint8Array) {
    const actual = this.codeFingerprint(challengeId, code);
    const stored = Buffer.from(expected);
    return actual.length === stored.length && timingSafeEqual(actual, stored);
  }

  createRecoveryToken() {
    const token = randomBytes(32).toString('base64url');
    return { token, fingerprint: this.tokenFingerprint(token) };
  }

  tokenFingerprint(token: string) {
    return this.fingerprint('doraf:buyer-recovery-session:v1', token);
  }

  private fingerprint(domain: string, value: string) {
    return createHmac('sha256', this.key)
      .update(`${domain}\0`, 'utf8')
      .update(value, 'utf8')
      .digest();
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';

@Injectable()
export class SessionTokenService {
  private readonly fingerprintKey: Buffer;

  constructor(config: ConfigService) {
    const encodedKey = config.get<string>('SESSION_FINGERPRINT_KEY_BASE64');
    if (!encodedKey) {
      throw new Error('SESSION_FINGERPRINT_KEY_BASE64 is required');
    }

    this.fingerprintKey = Buffer.from(encodedKey, 'base64');
    if (this.fingerprintKey.length < 32) {
      throw new Error('Session fingerprint key must be at least 32 bytes');
    }
  }

  create(): { token: string; fingerprint: Buffer } {
    const token = randomBytes(32).toString('base64url');
    return { token, fingerprint: this.fingerprint(token) };
  }

  fingerprint(token: string): Buffer {
    return createHmac('sha256', this.fingerprintKey)
      .update('doraf:session:v1\0', 'utf8')
      .update(token, 'utf8')
      .digest();
  }
}

import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { OtpTokenService } from './otp-token.service';

describe('OtpTokenService', () => {
  const service = new OtpTokenService(
    new ConfigService<Partial<AppEnvironment>, true>({
      OTP_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 3).toString('base64'),
    }),
  );

  it('creates six-digit codes', () => {
    expect(service.createCode()).toMatch(/^\d{6}$/);
  });

  it('binds a verifier to both challenge and code', () => {
    const fingerprint = service.codeFingerprint('challenge-a', '123456');

    expect(service.codeMatches('challenge-a', '123456', fingerprint)).toBe(
      true,
    );
    expect(service.codeMatches('challenge-b', '123456', fingerprint)).toBe(
      false,
    );
    expect(service.codeMatches('challenge-a', '654321', fingerprint)).toBe(
      false,
    );
  });

  it('creates opaque registration completion tokens', () => {
    const first = service.createCompletionToken();
    const second = service.createCompletionToken();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.fingerprint).toEqual(
      service.completionFingerprint(first.token),
    );
  });
});

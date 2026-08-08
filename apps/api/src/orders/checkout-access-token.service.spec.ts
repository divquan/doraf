import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { CheckoutAccessTokenService } from './checkout-access-token.service';

describe('CheckoutAccessTokenService', () => {
  const service = new CheckoutAccessTokenService({
    getOrThrow: () => Buffer.alloc(32, 7).toString('base64'),
  } as unknown as ConfigService<AppEnvironment, true>);

  it('binds a short-lived token to one order reference', () => {
    const expiresAt = new Date('2026-08-08T12:00:00.000Z');
    const token = service.create('DRF-123', expiresAt);

    expect(
      service.matches('DRF-123', token, new Date('2026-08-08T11:59:59.000Z')),
    ).toBe(true);
    expect(
      service.matches('DRF-456', token, new Date('2026-08-08T11:59:59.000Z')),
    ).toBe(false);
    expect(
      service.matches('DRF-123', token, new Date('2026-08-08T12:00:00.000Z')),
    ).toBe(false);
  });

  it('rejects tampered tokens', () => {
    const token = service.create(
      'DRF-123',
      new Date('2026-08-08T12:00:00.000Z'),
    );
    const tampered = `${token.slice(0, -1)}x`;

    expect(
      service.matches(
        'DRF-123',
        tampered,
        new Date('2026-08-08T11:59:59.000Z'),
      ),
    ).toBe(false);
  });
});

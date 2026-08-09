import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';

const TOKEN_VERSION = 1;
const TOKEN_DOMAIN = 'dashchecker:checkout-access:v1';
export const CHECKOUT_ACCESS_AFTER_AUTH_MS = 15 * 60_000;

interface CheckoutTokenPayload {
  v: number;
  orderReference: string;
  expiresAt: number;
}

@Injectable()
export class CheckoutAccessTokenService {
  private readonly key: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.key = Buffer.from(
      config.getOrThrow<string>('SESSION_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
  }

  expiresAtFor(authorizationExpiresAt: Date) {
    return new Date(
      authorizationExpiresAt.getTime() + CHECKOUT_ACCESS_AFTER_AUTH_MS,
    );
  }

  create(orderReference: string, expiresAt: Date) {
    const payload: CheckoutTokenPayload = {
      v: TOKEN_VERSION,
      orderReference,
      expiresAt: expiresAt.getTime(),
    };
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64url');
    const signature = this.sign(encodedPayload).toString('base64url');
    return `${encodedPayload}.${signature}`;
  }

  matches(orderReference: string, token: string | undefined, now = new Date()) {
    if (!token) return false;
    const [encodedPayload, encodedSignature, ...extra] = token.split('.');
    if (!encodedPayload || !encodedSignature || extra.length > 0) return false;

    let payload: CheckoutTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as CheckoutTokenPayload;
    } catch {
      return false;
    }
    if (
      payload.v !== TOKEN_VERSION ||
      payload.orderReference !== orderReference ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= now.getTime()
    ) {
      return false;
    }

    const expected = this.sign(encodedPayload);
    const actual = Buffer.from(encodedSignature, 'base64url');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private sign(encodedPayload: string) {
    return createHmac('sha256', this.key)
      .update(`${TOKEN_DOMAIN}\0${encodedPayload}`, 'utf8')
      .digest();
  }
}

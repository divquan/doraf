import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { AppEnvironment } from '../config/environment';

@Injectable()
export class CloudTasksOidcVerifier {
  private readonly logger = new Logger(CloudTasksOidcVerifier.name);
  private readonly expectedAudience: string;
  private readonly expectedServiceAccount: string;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    @Optional()
    @Inject('GOOGLE_OAUTH2_CLIENT')
    private readonly oauthClient?: OAuth2Client,
  ) {
    this.expectedAudience = this.config.get('CLOUD_TASKS_AUDIENCE', {
      infer: true,
    });
    this.expectedServiceAccount = this.config.get(
      'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL',
      { infer: true },
    );
  }

  private get client(): OAuth2Client {
    return this.oauthClient ?? new OAuth2Client();
  }

  async verifyAuthorizationHeader(authorizationHeader?: string): Promise<void> {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Invalid bearer token');
    }
    const token = match[1].trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    await this.verifyToken(token);
  }

  async verifyToken(token: string): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.expectedAudience,
      });
      payload = ticket.getPayload() as unknown as Record<string, unknown>;
      if (!payload) {
        throw new UnauthorizedException('Invalid token payload');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Audience mismatch should be 403, other verification failures 401
      if (message.toLowerCase().includes('audience')) {
        this.logger.warn(`OIDC audience mismatch: ${message.slice(0, 200)}`);
        throw new ForbiddenException('Invalid token audience');
      }
      this.logger.warn(`OIDC verification failed: ${message.slice(0, 200)}`);
      throw new UnauthorizedException('Invalid bearer token');
    }

    const email = payload['email'] as string | undefined;
    const emailVerified = payload['email_verified'] as boolean | undefined;
    const aud = payload['aud'] as string | undefined;
    const iss = payload['iss'] as string | undefined;

    if (aud !== this.expectedAudience) {
      throw new ForbiddenException('Invalid token audience');
    }

    if (email !== this.expectedServiceAccount) {
      throw new ForbiddenException('Invalid token principal');
    }

    if (emailVerified !== true) {
      throw new ForbiddenException('Email not verified');
    }

    if (
      iss !== 'https://accounts.google.com' &&
      iss !== 'accounts.google.com'
    ) {
      this.logger.warn(`OIDC invalid issuer: ${String(iss).slice(0, 200)}`);
      throw new UnauthorizedException('Invalid token issuer');
    }

    const exp = payload['exp'] as number | undefined;
    if (typeof exp === 'number' && exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
  }
}

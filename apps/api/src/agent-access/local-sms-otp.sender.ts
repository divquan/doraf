import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import type { SmsOtpSender } from './agent-access.types';
import { HubtelSmsOtpSender } from './hubtel-sms-otp.sender';

@Injectable()
export class LocalSmsOtpSender implements SmsOtpSender {
  private readonly logger = new Logger(LocalSmsOtpSender.name);

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly hubtel: HubtelSmsOtpSender,
  ) {}

  async send(destination: string, code: string): Promise<void> {
    const environment = this.config.get('NODE_ENV', { infer: true });
    if (environment === 'production') {
      throw new ServiceUnavailableException(
        'SMS delivery is not configured for production',
      );
    }

    if (environment === 'development') {
      this.logger.log(
        `Development SMS OTP sent to ${maskPhone(destination)}; code=${code}`,
      );
      if (this.hasHubtelCredentials()) {
        try {
          await this.hubtel.send(destination, code);
        } catch (error) {
          this.logger.warn(
            `Hubtel OTP best-effort send failed; use logged code ${(error as Error).message}`,
          );
        }
      }
    }

    return Promise.resolve();
  }

  private hasHubtelCredentials(): boolean {
    return Boolean(
      this.config.get('HUBTEL_CLIENT_ID', { infer: true }) &&
      this.config.get('HUBTEL_CLIENT_SECRET', { infer: true }) &&
      this.config.get('HUBTEL_SENDER_ID', { infer: true }),
    );
  }
}

function maskPhone(destination: string): string {
  return `${destination.slice(0, 4)}••••${destination.slice(-4)}`;
}

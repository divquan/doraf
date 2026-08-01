import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import type { SmsOtpSender } from './agent-access.types';

@Injectable()
export class LocalSmsOtpSender implements SmsOtpSender {
  private readonly logger = new Logger(LocalSmsOtpSender.name);

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  send(destination: string, code: string): Promise<void> {
    const environment = this.config.get('NODE_ENV', { infer: true });
    console.log('ENV: ', environment);
    if (environment === 'production') {
      throw new ServiceUnavailableException(
        'SMS delivery is not configured for production',
      );
    }

    if (environment === 'development') {
      this.logger.log(
        `Development SMS OTP sent to ${maskPhone(destination)}; code=${code}`,
      );
    }

    return Promise.resolve();
  }
}

function maskPhone(destination: string): string {
  return `${destination.slice(0, 4)}••••${destination.slice(-4)}`;
}

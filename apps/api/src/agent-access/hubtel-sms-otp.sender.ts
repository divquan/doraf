import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import type { SmsOtpSender } from './agent-access.types';
import { DeliverySubmissionError } from '../delivery/delivery-gateway.service';

const HUBTEL_TIMEOUT_MS = 8_000;

function normalizeGhanaPhone(destination: string): string {
  const digits = destination.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10)
    return `233${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('233')) return digits;
  // fallback: if 9 digits (without leading 0), prepend 233
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

@Injectable()
export class HubtelSmsOtpSender implements SmsOtpSender {
  private readonly logger = new Logger(HubtelSmsOtpSender.name);

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  async send(destination: string, code: string): Promise<void> {
    const clientId = this.config.get('HUBTEL_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('HUBTEL_CLIENT_SECRET', {
      infer: true,
    });
    const senderId = this.config.get('HUBTEL_SENDER_ID', { infer: true });
    const baseUrl = this.config.get('HUBTEL_BASE_URL', { infer: true });

    if (!clientId || !clientSecret || !senderId) {
      this.logger.error('Hubtel SMS not configured for OTP');
      throw new ServiceUnavailableException('SMS delivery is not configured');
    }

    const to = normalizeGhanaPhone(destination);
    const content = `Your Dashchecker verification code is ${code}. It expires in 5 minutes. Do not share this code.`;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HUBTEL_TIMEOUT_MS);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          From: senderId,
          To: to,
          Content: content,
          Type: 0,
          RegisteredDelivery: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const safeCode =
          `hubtel http ${response.status} ${body.slice(0, 120)}`.trim();
        if (response.status === 429 || response.status >= 500) {
          throw new DeliverySubmissionError('AMBIGUOUS', safeCode);
        }
        throw new DeliverySubmissionError('DEFINITIVE', safeCode);
      }

      const result = (await response.json().catch(() => ({}))) as {
        Status?: number;
        MessageId?: string;
        ResponseCode?: string;
      };

      // Hubtel returns Status 0 for success in some versions
      if (result.Status !== undefined && result.Status !== 0) {
        const safeCode =
          `hubtel status ${result.Status} ${result.ResponseCode ?? ''}`.trim();
        throw new DeliverySubmissionError('DEFINITIVE', safeCode);
      }

      this.logger.log(`Hubtel OTP accepted to=${mask(to)}`);
    } catch (error) {
      if (error instanceof DeliverySubmissionError) {
        throw new ServiceUnavailableException(error.safeCode);
      }
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('hubtel timeout');
      }
      this.logger.warn(
        `Hubtel OTP send failed to=${mask(to)} ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('hubtel network error');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function mask(destination: string): string {
  if (destination.length <= 4) return '••••';
  return `${destination.slice(0, 4)}••••${destination.slice(-4)}`;
}

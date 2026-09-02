import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import {
  DeliveryGateway,
  DeliverySubmission,
  DeliverySubmissionError,
  DeliverySubmissionResult,
} from './delivery-gateway.service';

const HUBTEL_TIMEOUT_MS = 10_000;
const LOOPS_TIMEOUT_MS = 10_000;
const LOOPS_ENDPOINT = 'https://app.loops.so/api/v1/transactional';

function normalizeGhanaPhone(destination: string): string {
  const digits = destination.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10)
    return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

@Injectable()
export class ProductionDeliveryGateway implements DeliveryGateway {
  private readonly logger = new Logger(ProductionDeliveryGateway.name);

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  async submit(input: DeliverySubmission): Promise<DeliverySubmissionResult> {
    if (input.channel === 'SMS') {
      return this.submitSms(input);
    }
    if (input.channel === 'EMAIL') {
      return this.submitEmail(input);
    }
    throw new DeliverySubmissionError(
      'DEFINITIVE',
      `unsupported channel ${String(input.channel)}`,
    );
  }

  private async submitSms(
    input: DeliverySubmission,
  ): Promise<DeliverySubmissionResult> {
    const clientId = this.config.get('HUBTEL_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('HUBTEL_CLIENT_SECRET', {
      infer: true,
    });
    const senderId = this.config.get('HUBTEL_SENDER_ID', { infer: true });
    const baseUrl = this.config.get('HUBTEL_BASE_URL', {
      infer: true,
    });

    if (!clientId || !clientSecret || !senderId) {
      throw new DeliverySubmissionError('DEFINITIVE', 'hubtel not configured');
    }

    const to = normalizeGhanaPhone(input.destination);
    const content =
      input.content ??
      `Your Dashchecker voucher ${input.stableClientReference} is ready.`;
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
          ClientReference: input.stableClientReference,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const safeCode =
          `hubtel http ${response.status} ${body.slice(0, 160)}`.trim();
        if (response.status === 429 || response.status >= 500) {
          throw new DeliverySubmissionError('AMBIGUOUS', safeCode);
        }
        throw new DeliverySubmissionError('DEFINITIVE', safeCode);
      }

      const result = (await response.json().catch(() => ({}))) as {
        Status?: number;
        MessageId?: string;
        ResponseCode?: string;
        Data?: { MessageId?: string };
      };

      if (result.Status !== undefined && result.Status !== 0) {
        const safeCode =
          `hubtel status ${result.Status} ${result.ResponseCode ?? ''}`.trim();
        throw new DeliverySubmissionError('DEFINITIVE', safeCode);
      }

      const providerMessageReference =
        result.MessageId ??
        result.Data?.MessageId ??
        `hubtel-${input.stableClientReference}`;

      this.logger.log(
        `Hubtel SMS accepted to=${input.destinationMask} ref=${input.stableClientReference}`,
      );
      return {
        provider: 'hubtel',
        providerMessageReference,
        safeMetadata: { adapter: 'hubtel', channel: input.channel },
      };
    } catch (error) {
      if (error instanceof DeliverySubmissionError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new DeliverySubmissionError('AMBIGUOUS', 'hubtel timeout');
      }
      this.logger.warn(
        `Hubtel SMS failed to=${input.destinationMask} ref=${input.stableClientReference} ${(error as Error).message}`,
      );
      throw new DeliverySubmissionError('AMBIGUOUS', 'hubtel network error');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async submitEmail(
    input: DeliverySubmission,
  ): Promise<DeliverySubmissionResult> {
    const apiKey = this.config.get('LOOPS_API_KEY', { infer: true });
    const transactionalId = this.config.get('LOOPS_VOUCHER_TRANSACTIONAL_ID', {
      infer: true,
    });

    if (!apiKey || !transactionalId) {
      throw new DeliverySubmissionError('DEFINITIVE', 'loops not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOPS_TIMEOUT_MS);

    try {
      const dataVariables: Record<string, unknown> = {
        ...(input.dataVariables ?? {}),
        deliveryReference: input.stableClientReference,
      };

      const response = await fetch(LOOPS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.stableClientReference,
        },
        body: JSON.stringify({
          transactionalId,
          email: input.destination,
          dataVariables,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const safeCode =
          `loops http ${response.status} ${body.slice(0, 160)}`.trim();
        if (response.status === 429 || response.status >= 500) {
          throw new DeliverySubmissionError('AMBIGUOUS', safeCode);
        }
        throw new DeliverySubmissionError('DEFINITIVE', safeCode);
      }

      const result = (await response.json().catch(() => ({}))) as {
        id?: string;
        messageId?: string;
      };
      const providerMessageReference =
        result.id ?? result.messageId ?? `loops-${input.stableClientReference}`;

      this.logger.log(
        `Loops email accepted to=${input.destinationMask} ref=${input.stableClientReference}`,
      );
      return {
        provider: 'loops',
        providerMessageReference,
        safeMetadata: { adapter: 'loops', channel: input.channel },
      };
    } catch (error) {
      if (error instanceof DeliverySubmissionError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new DeliverySubmissionError('AMBIGUOUS', 'loops timeout');
      }
      this.logger.warn(
        `Loops email failed to=${input.destinationMask} ref=${input.stableClientReference} ${(error as Error).message}`,
      );
      throw new DeliverySubmissionError('AMBIGUOUS', 'loops network error');
    } finally {
      clearTimeout(timeout);
    }
  }
}

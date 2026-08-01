import { Injectable, Logger } from '@nestjs/common';
import { DeliveryChannel } from '../generated/prisma/client';

export interface DeliverySubmission {
  channel: DeliveryChannel;
  destination: string;
  destinationMask: string;
  stableClientReference: string;
}

export interface DeliverySubmissionResult {
  provider: string;
  providerMessageReference: string;
  safeMetadata: Record<string, string>;
}

/** A provider error whose submission outcome is known and safe to retry. */
export class DeliverySubmissionError extends Error {
  constructor(
    readonly classification: 'DEFINITIVE' | 'AMBIGUOUS',
    readonly safeCode: string,
  ) {
    super(safeCode);
  }
}

@Injectable()
export class DevelopmentDeliveryGateway {
  private readonly logger = new Logger(DevelopmentDeliveryGateway.name);

  /**
   * Deliberately does not print recipient data or voucher content. This is a
   * deterministic accepted submission for local workflow testing only.
   */
  submit(input: DeliverySubmission): Promise<DeliverySubmissionResult> {
    const providerMessageReference = `dev-${input.stableClientReference}`;
    this.logger.log(
      `Development ${input.channel} accepted reference=${input.stableClientReference} destination=${input.destinationMask}`,
    );
    return Promise.resolve({
      provider: 'development',
      providerMessageReference,
      safeMetadata: { adapter: 'development' },
    });
  }
}

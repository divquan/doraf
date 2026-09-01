import { Injectable, Logger } from '@nestjs/common';
import { InvariantAuditorService } from './invariant-auditor.service';

@Injectable()
export class InvariantReconciliationWorker {
  private readonly logger = new Logger(InvariantReconciliationWorker.name);
  private running = false;

  constructor(private readonly auditor: InvariantAuditorService) {}

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const report = await this.auditor.runFullAudit();
      if (report.status === 'DISCREPANCY_DETECTED') {
        const failed = report.checks
          .filter((c) => c.status === 'FAIL')
          .map((c) => `${c.code}: ${c.details}`)
          .join(' | ');
        this.logger.error(
          `Bounded invariant audit detected anomalies: ${failed}`,
        );
      } else {
        this.logger.debug('Bounded invariant audit passed cleanly');
      }
    } catch (error) {
      this.logger.error(
        'Invariant reconciliation worker audit pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}

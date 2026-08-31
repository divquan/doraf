import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { InvariantAuditorService } from './invariant-auditor.service';
import { isContinuousWorker, isRunOnceWorker } from '../worker-runtime';

const AUDIT_INTERVAL_MS = 60_000;

@Injectable()
export class InvariantReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InvariantReconciliationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly auditor: InvariantAuditorService,
  ) {}

  onModuleInit() {
    if (!isContinuousWorker(this.config)) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), AUDIT_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Invariant reconciliation worker started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

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
          `Continuous invariant audit detected anomalies: ${failed}`,
        );
      } else {
        this.logger.debug('Continuous invariant audit passed cleanly');
      }
    } catch (error) {
      this.logger.error(
        'Invariant reconciliation worker audit pass failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (isRunOnceWorker(this.config)) throw error;
    } finally {
      this.running = false;
    }
  }
}

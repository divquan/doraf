import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from './config/environment';

export function isContinuousWorker(
  config: ConfigService<AppEnvironment, true>,
): boolean {
  return (
    config.get('NODE_ENV', { infer: true }) !== 'test' &&
    config.get('WORKER_ENABLED', { infer: true }) === true &&
    config.get('WORKER_EXECUTION', { infer: true }) === 'continuous'
  );
}

export function isRunOnceWorker(
  config: ConfigService<AppEnvironment, true>,
): boolean {
  return (
    config.get('WORKER_ENABLED', { infer: true }) === true &&
    config.get('WORKER_EXECUTION', { infer: true }) === 'run-once'
  );
}

export function isQueueWorkerEnabled(
  config: ConfigService<AppEnvironment, true>,
): boolean {
  if (config.get('WORKER_ENABLED', { infer: true }) !== true) {
    return false;
  }
  if (config.get('WORKER_EXECUTION', { infer: true }) === 'continuous') {
    return true;
  }
  return process.env.JOB_NAME === 'outbox' || process.env.JOB_NAME === 'all';
}

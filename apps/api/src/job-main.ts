import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';
import { GeneralOutboxWorker } from './operations/general-outbox.worker';
import { OutboxLeaseRecoveryWorker } from './operations/outbox-lease-recovery.worker';
import { RedisOutboxConsumer } from './operations/redis-outbox.consumer';
import { RedisOutboxDispatcher } from './operations/redis-outbox.dispatcher';
import { PaymentInitializationWorker } from './payments/payment-initialization.worker';
import { PaymentReconciliationWorker } from './payments/payment-reconciliation.worker';
import { PricingOutboxWorker } from './pricing/pricing-outbox.worker';
import { RefundOutboxWorker } from './refunds/refund-outbox.worker';
import { RefundReconciliationWorker } from './refunds/refund-reconciliation.worker';
import { InvariantReconciliationWorker } from './reporting/invariant-reconciliation.worker';
import { WithdrawalOutboxWorker } from './wallet/withdrawal-outbox.worker';
import { WithdrawalReconciliationWorker } from './wallet/withdrawal-reconciliation.worker';
import { DeliveryOutboxWorker } from './delivery/delivery-outbox.worker';
import type { AppEnvironment } from './config/environment';

const JOB_NAMES = [
  'outbox',
  'payment-initialization',
  'payment-reconciliation',
  'refund-reconciliation',
  'withdrawal-reconciliation',
  'lease-recovery',
  'invariant-audit',
  'all',
] as const;

type JobName = (typeof JOB_NAMES)[number];

async function bootstrap() {
  if (process.env.WORKER_ENABLED !== 'true') {
    throw new Error('Scheduled jobs require WORKER_ENABLED=true');
  }
  if (process.env.WORKER_EXECUTION !== 'run-once') {
    throw new Error('Scheduled jobs require WORKER_EXECUTION=run-once');
  }

  const jobName = parseJobName(process.argv[2] ?? process.env.JOB_NAME);
  process.env.JOB_NAME = jobName;
  const app = await NestFactory.createApplicationContext(WorkerAppModule);

  try {
    const config = app.get(ConfigService<AppEnvironment, true>);
    await runJob(app, config, jobName);
  } finally {
    await app.close();
  }
}

function parseJobName(value: string | undefined): JobName {
  if (value && (JOB_NAMES as readonly string[]).includes(value)) {
    return value as JobName;
  }
  throw new Error(`JOB_NAME must be one of: ${JOB_NAMES.join(', ')}`);
}

async function runJob(
  app: INestApplicationContext,
  config: ConfigService<AppEnvironment, true>,
  jobName: JobName,
): Promise<void> {
  switch (jobName) {
    case 'outbox':
      await runOutbox(app, config);
      return;
    case 'payment-initialization':
      await app.get(PaymentInitializationWorker).runOnce();
      return;
    case 'payment-reconciliation':
      await app.get(PaymentReconciliationWorker).runOnce();
      return;
    case 'refund-reconciliation':
      await app.get(RefundReconciliationWorker).runOnce();
      return;
    case 'withdrawal-reconciliation':
      await app.get(WithdrawalReconciliationWorker).runOnce();
      return;
    case 'lease-recovery':
      await app.get(OutboxLeaseRecoveryWorker).runOnce();
      return;
    case 'invariant-audit':
      await app.get(InvariantReconciliationWorker).runOnce();
      return;
    case 'all':
      await runOutbox(app, config);
      await app.get(PaymentInitializationWorker).runOnce();
      await app.get(PaymentReconciliationWorker).runOnce();
      await app.get(RefundReconciliationWorker).runOnce();
      await app.get(WithdrawalReconciliationWorker).runOnce();
      await app.get(OutboxLeaseRecoveryWorker).runOnce();
      await app.get(InvariantReconciliationWorker).runOnce();
      return;
  }
}

async function runOutbox(
  app: INestApplicationContext,
  config: ConfigService<AppEnvironment, true>,
): Promise<void> {
  if (config.get('QUEUE_PROVIDER', { infer: true }) === 'redis') {
    await app.get(RedisOutboxDispatcher).runOnce();
    await app.get(RedisOutboxConsumer).runOnce();
    return;
  }

  await app.get(GeneralOutboxWorker).runOnce();
  await app.get(PricingOutboxWorker).runOnce();
  await app.get(RefundOutboxWorker).runOnce();
  await app.get(WithdrawalOutboxWorker).runOnce();
  await app.get(DeliveryOutboxWorker).runOnce();
}

void bootstrap().catch((error) => {
  console.error('Scheduled job failed', error);
  process.exitCode = 1;
});

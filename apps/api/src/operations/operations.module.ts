import { Module } from '@nestjs/common';
import { GeneralOutboxWorker } from './general-outbox.worker';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';

@Module({
  providers: [IdempotencyService, OutboxService, GeneralOutboxWorker],
  exports: [IdempotencyService, OutboxService],
})
export class OperationsModule {}

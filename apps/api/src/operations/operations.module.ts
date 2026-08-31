import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';

@Module({
  providers: [IdempotencyService, OutboxService],
  exports: [IdempotencyService, OutboxService],
})
export class OperationsModule {}

import { Module } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';
import { CloudTasksOutboxDispatcher } from './cloud-tasks-outbox.dispatcher';
import { CloudTasksOutboxPublisher } from './cloud-tasks-outbox.publisher';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';

@Module({
  providers: [
    IdempotencyService,
    OutboxService,
    CloudTasksOutboxPublisher,
    CloudTasksOutboxDispatcher,
    {
      provide: 'CLOUD_TASKS_CLIENT',
      useFactory: () => new CloudTasksClient(),
    },
  ],
  exports: [
    IdempotencyService,
    OutboxService,
    CloudTasksOutboxPublisher,
    CloudTasksOutboxDispatcher,
  ],
})
export class OperationsModule {}

import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  Logger,
  InternalServerErrorException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxTaskDto } from './outbox-task.dto';
import { CloudTasksOidcVerifier } from './cloud-tasks-oidc.verifier';
import { OutboxTaskRouter } from './outbox-task.router';
import { OutboxState } from '../generated/prisma/client';

@Controller({ path: 'internal/tasks/outbox', version: VERSION_NEUTRAL })
export class OutboxTaskController {
  private readonly logger = new Logger(OutboxTaskController.name);

  constructor(
    private readonly verifier: CloudTasksOidcVerifier,
    private readonly router: OutboxTaskRouter,
    private readonly outbox: OutboxService,
  ) {}

  @Post()
  @HttpCode(204)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: OutboxTaskDto,
  ): Promise<void> {
    await this.verifier.verifyAuthorizationHeader(authorization);

    try {
      await this.router.handle({
        eventId: body.eventId,
        claimToken: body.claimToken,
      });
    } catch (error) {
      // If the error was already handled durably (state no longer CLAIMED/QUEUED), ack
      try {
        const current = await this.outbox.getState(body.eventId);
        if (
          !current ||
          (current.state !== OutboxState.CLAIMED && current.state !== OutboxState.QUEUED)
        ) {
          this.logger.log(
            `Outbox task deferred but already durable eventId=${body.eventId}`,
          );
          return;
        }
      } catch {
        // If we cannot determine state, treat as retryable
      }

      this.logger.warn(
        `Outbox task retryable failure eventId=${body.eventId} eventType=${body.eventType}`,
      );
      // Do not leak stack traces or provider payloads
      throw new InternalServerErrorException('Task processing deferred');
    }
  }
}

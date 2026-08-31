import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksClient } from '@google-cloud/tasks';
import type { AppEnvironment } from '../config/environment';

export interface CloudTasksOutboxTask {
  eventId: string;
  claimToken: string;
  eventType: string;
}

@Injectable()
export class CloudTasksOutboxPublisher {
  private readonly logger = new Logger(CloudTasksOutboxPublisher.name);
  private readonly client: CloudTasksClient;
  private readonly queuePath: string;
  private readonly targetUrl: string;
  private readonly serviceAccountEmail: string;
  private readonly audience: string;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    @Optional() @Inject('CLOUD_TASKS_CLIENT') client?: CloudTasksClient,
  ) {
    this.targetUrl = this.config.get('CLOUD_TASKS_TARGET_URL', {
      infer: true,
    });
    this.serviceAccountEmail = this.config.get(
      'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL',
      { infer: true },
    );
    this.audience = this.config.get('CLOUD_TASKS_AUDIENCE', { infer: true });
    const projectId = this.config.get('CLOUD_TASKS_PROJECT_ID', {
      infer: true,
    });
    const location = this.config.get('CLOUD_TASKS_LOCATION', { infer: true });
    const queue = this.config.get('CLOUD_TASKS_QUEUE', { infer: true });
    this.client = client ?? new CloudTasksClient();
    this.queuePath = this.client.queuePath(projectId, location, queue);
  }

  async publish(input: CloudTasksOutboxTask): Promise<void> {
    const taskName = this.buildTaskName(input.eventId, input.claimToken);
    const body = JSON.stringify({
      eventId: input.eventId,
      claimToken: input.claimToken,
      eventType: input.eventType,
    });
    const task = {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST' as const,
        url: this.targetUrl,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(body).toString('base64'),
        oidcToken: {
          serviceAccountEmail: this.serviceAccountEmail,
          audience: this.audience,
        },
      },
    };

    try {
      await this.client.createTask({ parent: this.queuePath, task } as never);
    } catch (error) {
      if (this.isAlreadyExistsForTask(error, taskName)) {
        this.logger.log(
          `Cloud Tasks already exists for event ${input.eventId} claim ${input.claimToken}`,
        );
        return;
      }
      throw error;
    }
  }

  getQueuePath(): string {
    return this.queuePath;
  }

  getTargetUrl(): string {
    return this.targetUrl;
  }

  getServiceAccountEmail(): string {
    return this.serviceAccountEmail;
  }

  getAudience(): string {
    return this.audience;
  }

  private buildTaskName(eventId: string, claimToken: string): string {
    const taskId = `${eventId}-${claimToken}`;
    return `${this.queuePath}/tasks/${taskId}`;
  }

  private isAlreadyExistsForTask(error: unknown, taskName: string): boolean {
    if (!isAlreadyExistsError(error)) return false;
    const message =
      error instanceof Error
        ? error.message
        : (error as Record<string, unknown>).message
          ? String((error as Record<string, unknown>).message)
          : String(error);
    const taskId = taskName.split('/').pop() ?? taskName;
    return message.includes(taskName) || message.includes(taskId);
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as Record<string, unknown>;
  const code = anyErr.code;
  if (code === 6 || code === 'ALREADY_EXISTS' || code === 409) return true;
  const message =
    typeof anyErr.message === 'string' ? anyErr.message : '';
  const details =
    typeof (anyErr as Record<string, unknown>).details === 'string'
      ? String((anyErr as Record<string, unknown>).details)
      : '';
  const combined = `${message} ${details}`;
  if (
    combined.includes('ALREADY_EXISTS') ||
    combined.toLowerCase().includes('already exists')
  )
    return true;
  // gRPC status object may have details array
  if (
    Array.isArray((anyErr as Record<string, unknown>).details) ||
    typeof anyErr.details === 'object'
  ) {
    const str = JSON.stringify(anyErr.details);
    if (str.includes('ALREADY_EXISTS')) return true;
  }
  return false;
}

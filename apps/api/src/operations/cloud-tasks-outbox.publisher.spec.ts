/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- test mocks use any and jest.fn without await */
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { CloudTasksOutboxPublisher } from './cloud-tasks-outbox.publisher';

function createConfig(
  values: Partial<AppEnvironment>,
): ConfigService<AppEnvironment, true> {
  const store: Record<string, unknown> = {
    CLOUD_TASKS_PROJECT_ID: 'my-project',
    CLOUD_TASKS_LOCATION: 'us-central1',
    CLOUD_TASKS_QUEUE: 'outbox',
    CLOUD_TASKS_TARGET_URL: 'https://api.example.com/api/outbox/tasks',
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
      'tasks@my-project.iam.gserviceaccount.com',
    CLOUD_TASKS_AUDIENCE: 'https://api.example.com/api/outbox/tasks',
    ...values,
  };
  return {
    get: ((key: string) => store[key]) as never,
  } as unknown as ConfigService<AppEnvironment, true>;
}

function createFakeClient() {
  const calls: unknown[] = [];
  const client = {
    queuePath: jest.fn(
      (project: string, location: string, queue: string) =>
        `projects/${project}/locations/${location}/queues/${queue}`,
    ),
    createTask: jest.fn(async (request: unknown) => {
      calls.push(request);
      return [{ name: 'created' }];
    }),
  } as unknown as {
    queuePath: jest.Mock;
    createTask: jest.Mock;
    _calls: unknown[];
  };
  (client as unknown as Record<string, unknown>)._calls = calls;
  return client;
}

describe('CloudTasksOutboxPublisher', () => {
  it('creates a task with exact queue path, deterministic name, minimal body, target URL and OIDC', async () => {
    const config = createConfig({});
    const client = createFakeClient();
    const publisher = new CloudTasksOutboxPublisher(config, client as never);

    const eventId = '11111111-1111-1111-1111-111111111111';
    const claimToken = '22222222-2222-2222-2222-222222222222';
    const eventType = 'REFUND_SUBMISSION_REQUIRED';

    await publisher.publish({ eventId, claimToken, eventType });

    expect(client.queuePath).toHaveBeenCalledWith(
      'my-project',
      'us-central1',
      'outbox',
    );
    expect(client.createTask).toHaveBeenCalledTimes(1);
    const request = client.createTask.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(request.parent).toBe(
      'projects/my-project/locations/us-central1/queues/outbox',
    );
    const task = request.task as Record<string, unknown>;
    expect(task.name).toBe(
      `projects/my-project/locations/us-central1/queues/outbox/tasks/${eventId}-${claimToken}`,
    );

    const httpRequest = task.httpRequest as Record<string, unknown>;
    expect(httpRequest.url).toBe('https://api.example.com/api/outbox/tasks');
    expect(httpRequest.httpMethod).toBe('POST');
    expect(
      (httpRequest.headers as Record<string, string>)['Content-Type'],
    ).toBe('application/json');

    const oidcToken = httpRequest.oidcToken as Record<string, string>;
    expect(oidcToken.serviceAccountEmail).toBe(
      'tasks@my-project.iam.gserviceaccount.com',
    );
    expect(oidcToken.audience).toBe('https://api.example.com/api/outbox/tasks');

    const bodyJson = JSON.parse(
      Buffer.from(httpRequest.body as string, 'base64').toString('utf8'),
    ) as Record<string, unknown>;
    expect(Object.keys(bodyJson).sort()).toEqual([
      'claimToken',
      'eventId',
      'eventType',
    ]);
    expect(bodyJson).toEqual({ eventId, claimToken, eventType });
    // Ensure no secret payload fields are present
    expect(bodyJson).not.toHaveProperty('payload');
    expect(bodyJson).not.toHaveProperty('voucher');
    expect(bodyJson).not.toHaveProperty('phone');
  });

  it('uses deterministic task name for same event and claim token', async () => {
    const config = createConfig({});
    const client = createFakeClient();
    const publisher = new CloudTasksOutboxPublisher(config, client as never);

    const eventId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const claimToken = 'ffffffff-1111-2222-3333-444444444444';

    await publisher.publish({
      eventId,
      claimToken,
      eventType: 'PAYMENT_INITIALIZATION_REQUESTED',
    });
    await publisher.publish({
      eventId,
      claimToken,
      eventType: 'PAYMENT_INITIALIZATION_REQUESTED',
    });

    const first = (
      client.createTask.mock.calls[0][0] as Record<
        string,
        Record<string, string>
      >
    ).task.name;
    const second = (
      client.createTask.mock.calls[1][0] as Record<
        string,
        Record<string, string>
      >
    ).task.name;
    expect(first).toBe(second);
  });

  it('treats already-exists for same deterministic task as success', async () => {
    const config = createConfig({});
    const eventId = '33333333-3333-3333-3333-333333333333';
    const claimToken = '44444444-4444-4444-4444-444444444444';
    const expectedTaskName = `projects/my-project/locations/us-central1/queues/outbox/tasks/${eventId}-${claimToken}`;
    const client = {
      queuePath: jest.fn(
        () => 'projects/my-project/locations/us-central1/queues/outbox',
      ),
      createTask: jest.fn(async () => {
        const err = Object.assign(
          new Error(`Task ${expectedTaskName} already exists ALREADY_EXISTS`),
          { code: 6 },
        );
        throw err;
      }),
    };

    const publisher = new CloudTasksOutboxPublisher(config, client as never);
    await expect(
      publisher.publish({
        eventId,
        claimToken,
        eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED',
      }),
    ).resolves.toBeUndefined();
    expect(client.createTask).toHaveBeenCalledTimes(1);
  });

  it('propagates provider error that is not already-exists for same task', async () => {
    const config = createConfig({});
    const client = {
      queuePath: jest.fn(
        () => 'projects/my-project/locations/us-central1/queues/outbox',
      ),
      createTask: jest.fn(async () => {
        throw Object.assign(new Error('UNAVAILABLE: temporarily unavailable'), {
          code: 14,
        });
      }),
    };
    const publisher = new CloudTasksOutboxPublisher(config, client as never);

    await expect(
      publisher.publish({
        eventId: 'x',
        claimToken: 'y',
        eventType: 'REFUND_SUBMISSION_REQUIRED',
      }),
    ).rejects.toThrow('UNAVAILABLE');
  });

  it('does not treat already-exists for different task as success', async () => {
    const config = createConfig({});
    const client = {
      queuePath: jest.fn(
        () => 'projects/my-project/locations/us-central1/queues/outbox',
      ),
      createTask: jest.fn(async () => {
        const err = Object.assign(
          new Error(
            'Task projects/my-project/locations/us-central1/queues/outbox/tasks/other-id already exists ALREADY_EXISTS',
          ),
          { code: 6 },
        );
        throw err;
      }),
    };
    const publisher = new CloudTasksOutboxPublisher(config, client as never);

    await expect(
      publisher.publish({
        eventId: 'my-event',
        claimToken: 'my-token',
        eventType: 'REFUND_SUBMISSION_REQUIRED',
      }),
    ).rejects.toThrow('already exists');
  });
});

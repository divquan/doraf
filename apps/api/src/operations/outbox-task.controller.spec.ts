import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { OutboxTaskController } from './outbox-task.controller';
import { CloudTasksOidcVerifier } from './cloud-tasks-oidc.verifier';
import { OutboxTaskRouter } from './outbox-task.router';
import { OutboxService } from './outbox.service';

type HttpServer = Parameters<typeof request>[0];

function getServer(app: INestApplication): HttpServer {
  return app.getHttpAdapter().getInstance() as HttpServer;
}

describe('OutboxTaskController (task-consumer)', () => {
  let app: INestApplication;
  let router: { handle: jest.Mock };
  let verifier: { verifyAuthorizationHeader: jest.Mock };
  let outbox: { getState: jest.Mock };

  beforeEach(async () => {
    router = { handle: jest.fn(() => Promise.resolve()) };
    verifier = { verifyAuthorizationHeader: jest.fn(() => Promise.resolve()) };
    outbox = {
      getState: jest.fn(() => Promise.resolve({ state: 'CLAIMED' })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [OutboxTaskController],
      providers: [
        { provide: CloudTasksOidcVerifier, useValue: verifier },
        { provide: OutboxTaskRouter, useValue: router },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validBody = {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    claimToken: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    eventType: 'REFUND_SUBMISSION_REQUIRED',
  };

  it('returns 204 for valid authenticated request', async () => {
    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send(validBody)
      .expect(204);
    expect(router.handle).toHaveBeenCalledWith({
      eventId: validBody.eventId,
      claimToken: validBody.claimToken,
    });
  });

  it('returns 401 for missing bearer token and does not call router', async () => {
    verifier.verifyAuthorizationHeader.mockImplementation(() => {
      throw new UnauthorizedException('Missing bearer token');
    });

    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .send(validBody)
      .expect(401);
    expect(router.handle).not.toHaveBeenCalled();
  });

  it('returns 403 for wrong principal and does not call router', async () => {
    verifier.verifyAuthorizationHeader.mockImplementation(() => {
      throw new ForbiddenException('Invalid token principal');
    });

    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer bad-principal')
      .send(validBody)
      .expect(403);
    expect(router.handle).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed body and does not call router', async () => {
    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send({
        eventId: 'not-uuid',
        claimToken: validBody.claimToken,
        eventType: validBody.eventType,
      })
      .expect(400);
    expect(router.handle).not.toHaveBeenCalled();
  });

  it('returns 400 for unknown fields (whitelist + forbidNonWhitelisted)', async () => {
    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send({ ...validBody, extra: 'field' })
      .expect(400);
    expect(router.handle).not.toHaveBeenCalled();
  });

  it('returns 500 for transient router error when state still CLAIMED', async () => {
    router.handle.mockRejectedValueOnce(new Error('transient DB error'));
    outbox.getState.mockResolvedValueOnce({ state: 'CLAIMED' });

    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send(validBody)
      .expect(500);
  });

  it('returns 204 for retryable error already durably rescheduled (state no longer CLAIMED)', async () => {
    router.handle.mockRejectedValueOnce(new Error('refund definitive'));
    outbox.getState.mockResolvedValueOnce({ state: 'FAILED' });

    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send(validBody)
      .expect(204);
  });

  it('returns 204 for stale task (router succeeds without error)', async () => {
    router.handle.mockResolvedValueOnce(undefined);

    await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send(validBody)
      .expect(204);
  });

  it('does not leak stack traces or provider payloads', async () => {
    router.handle.mockRejectedValueOnce(
      new Error('provider payload: {"secret":"voucher"}'),
    );
    outbox.getState.mockResolvedValueOnce({ state: 'CLAIMED' });

    const res = await request(getServer(app))
      .post('/internal/tasks/outbox')
      .set('Authorization', 'Bearer valid')
      .send(validBody)
      .expect(500);
    const responseBody = res.body as Record<string, unknown>;
    expect(String(responseBody.message)).not.toContain('voucher');
    expect(String(responseBody.message)).not.toContain('secret');
    expect(JSON.stringify(responseBody)).not.toContain('stack');
  });
});

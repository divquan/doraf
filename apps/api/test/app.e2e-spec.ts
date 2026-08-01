import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/configure-application';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('denies anonymous inventory import access', () => {
    return request(app.getHttpServer())
      .post('/v1/admin/inventory/imports/preview')
      .send({})
      .expect(401);
  });

  it('validates passkey enrollment input before accessing persistence', () => {
    return request(app.getHttpServer())
      .post('/v1/internal-auth/passkeys/registration/options')
      .send({ enrollmentToken: 'invalid', credentialName: '' })
      .expect('Cache-Control', 'no-store')
      .expect(400);
  });

  it('denies anonymous internal-user invitations', () => {
    return request(app.getHttpServer())
      .post('/v1/admin/internal-users')
      .send({
        displayName: 'Support Operator',
        role: 'SUPPORT',
        reason: 'Onboard support operator',
      })
      .expect(401);
  });

  it('denies anonymous agent suspension', () => {
    return request(app.getHttpServer())
      .post('/v1/admin/agents/00000000-0000-4000-8000-000000000000/suspend')
      .send({ reason: 'Repeated policy violation' })
      .expect(401);
  });

  it('denies anonymous pricing administration access', () => {
    return request(app.getHttpServer())
      .get('/v1/admin/products/pricing')
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});

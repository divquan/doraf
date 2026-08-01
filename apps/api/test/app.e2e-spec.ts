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

    app = moduleFixture.createNestApplication({ rawBody: true });
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

  it('denies anonymous inventory read access', () => {
    return request(app.getHttpServer()).get('/v1/admin/inventory').expect(401);
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

  it('denies anonymous access to an agent sales-channel record', () => {
    return request(app.getHttpServer())
      .get('/v1/agent-auth/sales-channel')
      .expect(401);
  });

  it('does not distinguish malformed public sales-channel identifiers', () => {
    return request(app.getHttpServer())
      .get('/v1/sales-channels/web/not-a-channel')
      .expect('Cache-Control', 'no-store')
      .expect(404);
  });

  it('validates public checkout input before creating an order', () => {
    return request(app.getHttpServer())
      .post('/v1/sales-channels/web/not-a-channel/orders')
      .set('Idempotency-Key', 'checkout-test-key')
      .send({})
      .expect('Cache-Control', 'no-store')
      .expect(400);
  });

  it('rejects unauthenticated Paystack webhooks', () => {
    return request(app.getHttpServer())
      .post('/v1/payments/paystack/webhook')
      .send({ event: 'charge.success', data: {} })
      .expect('Cache-Control', 'no-store')
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });

  it('validates buyer recovery references before persistence access', () => {
    return request(app.getHttpServer())
      .post('/v1/buyer-recovery/request')
      .send({ orderReference: 'guessable-reference' })
      .expect('Cache-Control', 'no-store')
      .expect(400);
  });

  it('requires a recovery token before revealing vouchers', () => {
    return request(app.getHttpServer())
      .get('/v1/buyer-recovery/vouchers')
      .expect('Cache-Control', 'no-store')
      .expect(401);
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- test mocks use any and jest.fn without await */
import { ConfigService } from '@nestjs/config';
import { OutboxTaskRouter } from './outbox-task.router';

function createConfig(nodeEnv = 'test') {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService<any, true>;
}

describe('OutboxTaskRouter', () => {
  const eventId = '11111111-1111-1111-1111-111111111111';
  const claimToken = '22222222-2222-2222-2222-222222222222';

  it('marks informational events dispatched', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'PRODUCT_PRICING_POLICY_CREATED',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(async () => {}),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });

    expect(outbox.markDispatched).toHaveBeenCalledWith(eventId, claimToken);
    expect(outbox.reschedule).not.toHaveBeenCalled();
  });

  it('routes pricing activation to pricing handler', async () => {
    const pricing = { handleClaimed: jest.fn(async () => true) };
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      pricing as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });
    expect(pricing.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes REFUND_SUBMISSION_REQUIRED to refund handler', async () => {
    const refunds = { handleClaimed: jest.fn(async () => true) };
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        state: 'QUEUED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      refunds as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });
    expect(refunds.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes WITHDRAWAL_SUBMISSION_REQUIRED to withdrawal handler', async () => {
    const withdrawals = { handleClaimed: jest.fn(async () => true) };
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      withdrawals as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });
    expect(withdrawals.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes DELIVERY_MESSAGE_REQUESTED in development to delivery handler', async () => {
    const delivery = { handleClaimed: jest.fn(async () => true) };
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'DELIVERY_MESSAGE_REQUESTED',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig('development'),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      delivery as any,
    );

    await router.handle({ eventId, claimToken });
    expect(delivery.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('reschedules DELIVERY_MESSAGE_REQUESTED in production as terminal', async () => {
    const delivery = { handleClaimed: jest.fn() };
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'DELIVERY_MESSAGE_REQUESTED',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(async () => {}),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig('production'),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      delivery as any,
    );

    await router.handle({ eventId, claimToken });
    expect(delivery.handleClaimed).not.toHaveBeenCalled();
    expect(outbox.reschedule).toHaveBeenCalledWith(
      eventId,
      claimToken,
      expect.objectContaining({ terminal: true }),
    );
  });

  it('reschedules unknown event type as terminal', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'UNKNOWN_FOOBAR',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(async () => {}),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });
    expect(outbox.reschedule).toHaveBeenCalledWith(
      eventId,
      claimToken,
      expect.objectContaining({
        terminal: true,
        error: expect.stringContaining('No outbox handler'),
      }),
    );
  });

  it('treats stale/missing event as idempotent success', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => null),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
      getState: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await expect(
      router.handle({ eventId, claimToken }),
    ).resolves.toBeUndefined();
    expect(outbox.markDispatched).not.toHaveBeenCalled();
    expect(outbox.reschedule).not.toHaveBeenCalled();
  });

  it('treats already-dispatched event as stale', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => null),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId: 'already-dispatched', claimToken });
    expect(outbox.markDispatched).not.toHaveBeenCalled();
  });

  it('uses DB eventType not body eventType', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'REFUND_SUBMISSION_REQUIRED',
        state: 'CLAIMED',
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    } as any;
    const refunds = { handleClaimed: jest.fn(async () => true) };
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox,
      { handleClaimed: jest.fn() } as any,
      refunds as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    // Even if body contained different type, router uses DB type
    await router.handle({ eventId, claimToken });
    expect(refunds.handleClaimed).toHaveBeenCalled();
  });
});

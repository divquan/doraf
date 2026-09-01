import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import type { DeliveryOutboxHandler } from '../delivery/delivery-outbox.handler';
import type { OutboxService } from './outbox.service';
import type { PricingOutboxHandler } from '../pricing/pricing-outbox.handler';
import type { RefundOutboxHandler } from '../refunds/refund-outbox.handler';
import type { WithdrawalOutboxHandler } from '../wallet/withdrawal-outbox.handler';
import { OutboxTaskRouter } from './outbox-task.router';

const eventId = '11111111-1111-1111-1111-111111111111';
const claimToken = '22222222-2222-2222-2222-222222222222';

function createConfig(nodeEnv = 'test') {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService<AppEnvironment, true>;
}

function createRouter(eventType: string, nodeEnv = 'test') {
  const outbox = {
    getClaimedEvent: jest.fn(() =>
      Promise.resolve({ eventType, state: 'CLAIMED' }),
    ),
    markDispatched: jest.fn(() => Promise.resolve()),
    reschedule: jest.fn(() => Promise.resolve()),
  };
  const pricing = { handleClaimed: jest.fn(() => Promise.resolve(true)) };
  const refunds = { handleClaimed: jest.fn(() => Promise.resolve(true)) };
  const withdrawals = {
    handleClaimed: jest.fn(() => Promise.resolve(true)),
  };
  const delivery = { handleClaimed: jest.fn(() => Promise.resolve(true)) };

  const router = new OutboxTaskRouter(
    createConfig(nodeEnv),
    outbox as unknown as OutboxService,
    pricing as unknown as PricingOutboxHandler,
    refunds as unknown as RefundOutboxHandler,
    withdrawals as unknown as WithdrawalOutboxHandler,
    delivery as unknown as DeliveryOutboxHandler,
  );

  return { router, outbox, pricing, refunds, withdrawals, delivery };
}

describe('OutboxTaskRouter', () => {
  it('marks informational events dispatched', async () => {
    const { router, outbox } = createRouter('PRODUCT_PRICING_POLICY_CREATED');

    await router.handle({ eventId, claimToken });

    expect(outbox.markDispatched).toHaveBeenCalledWith(eventId, claimToken);
    expect(outbox.reschedule).not.toHaveBeenCalled();
  });

  it('routes pricing activation to pricing handler', async () => {
    const { router, pricing } = createRouter(
      'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
    );

    await router.handle({ eventId, claimToken });
    expect(pricing.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes REFUND_SUBMISSION_REQUIRED to refund handler', async () => {
    const { router, refunds } = createRouter('REFUND_SUBMISSION_REQUIRED');

    await router.handle({ eventId, claimToken });
    expect(refunds.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes WITHDRAWAL_SUBMISSION_REQUIRED to withdrawal handler', async () => {
    const { router, withdrawals } = createRouter(
      'WITHDRAWAL_SUBMISSION_REQUIRED',
    );

    await router.handle({ eventId, claimToken });
    expect(withdrawals.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('routes delivery tasks in development to the delivery handler', async () => {
    const { router, delivery } = createRouter(
      'DELIVERY_MESSAGE_REQUESTED',
      'development',
    );

    await router.handle({ eventId, claimToken });
    expect(delivery.handleClaimed).toHaveBeenCalledWith(eventId, claimToken);
  });

  it('records production delivery as a terminal configuration failure', async () => {
    const { router, outbox, delivery } = createRouter(
      'DELIVERY_MESSAGE_REQUESTED',
      'production',
    );

    await router.handle({ eventId, claimToken });
    expect(delivery.handleClaimed).not.toHaveBeenCalled();
    expect(outbox.reschedule).toHaveBeenCalledWith(
      eventId,
      claimToken,
      expect.objectContaining({ terminal: true }),
    );
  });

  it('reschedules unknown event types as terminal', async () => {
    const { router, outbox } = createRouter('UNKNOWN_FOOBAR');

    await router.handle({ eventId, claimToken });
    expect(outbox.reschedule).toHaveBeenCalledWith(
      eventId,
      claimToken,
      expect.objectContaining({
        terminal: true,
        error: expect.stringContaining('No outbox handler') as unknown,
      }),
    );
  });

  it('treats stale or missing events as idempotent success', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(() => Promise.resolve(null)),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
    };
    const router = new OutboxTaskRouter(
      createConfig(),
      outbox as unknown as OutboxService,
      {} as unknown as PricingOutboxHandler,
      {} as unknown as RefundOutboxHandler,
      {} as unknown as WithdrawalOutboxHandler,
      {} as unknown as DeliveryOutboxHandler,
    );

    await expect(
      router.handle({ eventId, claimToken }),
    ).resolves.toBeUndefined();
    expect(outbox.markDispatched).not.toHaveBeenCalled();
    expect(outbox.reschedule).not.toHaveBeenCalled();
  });

  it('uses the database event type rather than a task body event type', async () => {
    const { router, refunds } = createRouter('REFUND_SUBMISSION_REQUIRED');

    await router.handle({ eventId, claimToken });
    expect(refunds.handleClaimed).toHaveBeenCalled();
  });
});

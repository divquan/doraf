/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { OutboxTaskRouter } from './outbox-task.router';
import { RefundState, OutboxState } from '../generated/prisma/client';

describe('OutboxTaskRouter durable state transitions (unit with in-memory fake)', () => {
  function createFakeOutbox(initialState: OutboxState = OutboxState.CLAIMED) {
    let state = initialState;
    let lastError: string | null = null;
    const store = new Map<
      string,
      { state: OutboxState; lastError: string | null }
    >();

    const getClaimedEvent = jest.fn(async (id: string, token: string) => {
      if (state === OutboxState.CLAIMED || state === OutboxState.QUEUED) {
        return { eventType: 'PRODUCT_PRICING_POLICY_CREATED', state };
      }
      return null;
    });

    const markDispatched = jest.fn(async (id: string, token: string) => {
      if (state !== OutboxState.CLAIMED && state !== OutboxState.QUEUED) {
        throw new Error('Outbox claim is no longer active');
      }
      state = OutboxState.DISPATCHED;
      store.set(id, { state, lastError });
    });

    const reschedule = jest.fn(
      async (
        id: string,
        token: string,
        input: { availableAt: Date; error: string; terminal?: boolean },
      ) => {
        if (state !== OutboxState.CLAIMED && state !== OutboxState.QUEUED) {
          throw new Error('Outbox claim is no longer active');
        }
        state = input.terminal ? OutboxState.FAILED : OutboxState.PENDING;
        lastError = input.error;
        store.set(id, { state, lastError });
      },
    );

    const getState = jest.fn(async (id: string) => ({ state }));

    return {
      getClaimedEvent,
      markDispatched,
      reschedule,
      getState,
      getCurrentState: () => state,
      getLastError: () => lastError,
    };
  }

  it('transitions informational event to DISPATCHED', async () => {
    const outbox = createFakeOutbox(OutboxState.CLAIMED);
    const config = { get: () => 'test' } as any;
    const router = new OutboxTaskRouter(
      config,
      outbox as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId: 'e1', claimToken: 'c1' });
    expect(outbox.markDispatched).toHaveBeenCalled();
    expect(outbox.getCurrentState()).toBe(OutboxState.DISPATCHED);
  });

  it('reschedules unknown event to FAILED (terminal)', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => ({
        eventType: 'UNKNOWN_EVENT',
        state: OutboxState.CLAIMED,
      })),
      markDispatched: jest.fn(),
      reschedule: jest.fn(async (id: string, token: string, input: any) => {
        expect(input.terminal).toBe(true);
        expect(input.error).toContain('No outbox handler');
      }),
    } as any;
    const config = { get: () => 'test' } as any;
    const router = new OutboxTaskRouter(
      config,
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId: 'e2', claimToken: 'c2' });
    expect(outbox.reschedule).toHaveBeenCalledWith(
      'e2',
      'c2',
      expect.objectContaining({ terminal: true }),
    );
  });

  it('reschedules delivery in production to FAILED', async () => {
    const outbox = createFakeOutbox(OutboxState.CLAIMED);
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? 'production' : 'test'),
    } as any;
    const router = new OutboxTaskRouter(
      config,
      outbox as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    // Need to mock getClaimedEvent to return delivery type
    outbox.getClaimedEvent = jest.fn(async () => ({
      eventType: 'DELIVERY_MESSAGE_REQUESTED',
      state: OutboxState.CLAIMED,
    })) as any;

    await router.handle({ eventId: 'e3', claimToken: 'c3' });
    expect(outbox.reschedule).toHaveBeenCalled();
    expect(outbox.getCurrentState()).toBe(OutboxState.FAILED);
  });

  it('treats stale claim as success without state change', async () => {
    const outbox = {
      getClaimedEvent: jest.fn(async () => null),
      markDispatched: jest.fn(),
      reschedule: jest.fn(),
      getState: jest.fn(async () => ({ state: OutboxState.DISPATCHED })),
    } as any;
    const config = { get: () => 'test' } as any;
    const router = new OutboxTaskRouter(
      config,
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await expect(
      router.handle({ eventId: 'stale', claimToken: 'old' }),
    ).resolves.toBeUndefined();
    expect(outbox.markDispatched).not.toHaveBeenCalled();
    expect(outbox.reschedule).not.toHaveBeenCalled();
  });

  it('handles QUEUED state the same as CLAIMED for already-accepted publisher crash', async () => {
    const outbox = createFakeOutbox(OutboxState.QUEUED);
    const config = { get: () => 'test' } as any;
    const router = new OutboxTaskRouter(
      config,
      outbox as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId: 'e4', claimToken: 'c4' });
    expect(outbox.markDispatched).toHaveBeenCalled();
    expect(outbox.getCurrentState()).toBe(OutboxState.DISPATCHED);
  });
});

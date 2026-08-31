/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- test mocks use any and jest.fn without await */
import { OutboxTaskRouter } from './outbox-task.router';
import { RefundOutboxHandler } from '../refunds/refund-outbox.handler';
import { RefundState, OutboxState } from '../generated/prisma/client';

describe('OutboxTaskRouter duplicate safety', () => {
  const eventId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const claimToken = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('second submission of same task produces no duplicate handler effect', async () => {
    let markDispatchedCount = 0;
    let dbState: 'CLAIMED' | 'QUEUED' | 'DISPATCHED' | 'PENDING' = 'CLAIMED';

    const config = { get: () => 'test' } as any;
    const outbox = {
      getClaimedEvent: jest.fn(async () => {
        if (dbState === 'CLAIMED' || dbState === 'QUEUED') {
          return {
            eventType: 'PRODUCT_PRICING_POLICY_CREATED',
            state: dbState,
          };
        }
        return null;
      }),
      markDispatched: jest.fn(async () => {
        markDispatchedCount += 1;
        dbState = 'DISPATCHED';
      }),
      reschedule: jest.fn(),
    } as any;

    const router = new OutboxTaskRouter(
      config,
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    await router.handle({ eventId, claimToken });
    expect(markDispatchedCount).toBe(1);

    await router.handle({ eventId, claimToken });
    expect(markDispatchedCount).toBe(1);
  });

  it('concurrent duplicate deliveries result in exactly one dispatch via DB claim', async () => {
    const config = { get: () => 'test' } as any;
    let dbState: OutboxState = OutboxState.CLAIMED;
    let markDispatchedCalls = 0;

    const outbox = {
      getClaimedEvent: jest.fn(async () => {
        if (dbState === OutboxState.CLAIMED || dbState === OutboxState.QUEUED) {
          return {
            eventType: 'PRODUCT_PRICING_POLICY_CREATED',
            state: dbState,
          };
        }
        return null;
      }),
      markDispatched: jest.fn(async () => {
        if (dbState !== OutboxState.CLAIMED && dbState !== OutboxState.QUEUED) {
          throw new Error('Outbox claim is no longer active');
        }
        markDispatchedCalls += 1;
        dbState = OutboxState.DISPATCHED;
      }),
      reschedule: jest.fn(),
      getState: jest.fn(async () => ({ state: dbState })),
    } as any;

    const router = new OutboxTaskRouter(
      config,
      outbox,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
      { handleClaimed: jest.fn() } as any,
    );

    const results = await Promise.allSettled([
      router.handle({ eventId, claimToken }),
      router.handle({ eventId, claimToken }),
    ]);

    expect(results.length).toBe(2);
    expect(markDispatchedCalls).toBe(1);
  });

  it('refund concurrent duplicate results in single provider submission via atomic claim', async () => {
    const eventIdRefund = '11111111-1111-1111-1111-111111111111';
    const claimTokenRefund = '22222222-2222-2222-2222-222222222222';
    const refundId = 'refund-123';

    let refundState: RefundState = RefundState.APPROVED;
    let submissionKeyInDb: string | null = null;
    let updateManyCallCount = 0;
    let submitRefundCalls = 0;

    const prisma = {
      outboxEvent: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (
            where.id === eventIdRefund &&
            where.claimToken === claimTokenRefund
          ) {
            return {
              id: eventIdRefund,
              aggregateId: refundId,
              eventType: 'REFUND_SUBMISSION_REQUIRED',
            };
          }
          return null;
        }),
      },
      refund: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === refundId) {
            return {
              id: refundId,
              state: refundState,
              submissionKey: submissionKeyInDb,
              providerReference: null,
              amountMinor: 1000n,
              currency: 'GHS',
              paymentAttempt: {
                providerReference: 'tx-123',
                providerTransactionId: null,
              },
              safeMetadata: {},
            };
          }
          return {
            id: refundId,
            state: refundState,
            submissionKey: submissionKeyInDb,
            providerReference: null,
            amountMinor: 1000n,
            currency: 'GHS',
            paymentAttempt: {
              providerReference: 'tx-123',
              providerTransactionId: null,
            },
            safeMetadata: {},
          };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          updateManyCallCount += 1;
          if (
            where.state === RefundState.APPROVED &&
            where.submissionKey === null
          ) {
            if (
              submissionKeyInDb === null &&
              refundState === RefundState.APPROVED
            ) {
              submissionKeyInDb = data.submissionKey;
              refundState = RefundState.SUBMITTING;
              return { count: 1 };
            }
            return { count: 0 };
          }
          return { count: 0 };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          if (data.state) refundState = data.state;
          return {};
        }),
      },
    } as any;

    const gateway = {
      findRefundByTransaction: jest.fn(async () => null),
      submitRefund: jest.fn(async () => {
        submitRefundCalls += 1;
        return { reference: 'refund-ref', status: 'pending' };
      }),
    } as any;

    const outbox = {
      getClaimedEvent: jest.fn(async (id, token) => {
        if (id === eventIdRefund && token === claimTokenRefund) {
          return { eventType: 'REFUND_SUBMISSION_REQUIRED', state: 'CLAIMED' };
        }
        return null;
      }),
      markDispatched: jest.fn(async () => {}),
      reschedule: jest.fn(async () => {}),
      getState: jest.fn(async () => ({ state: refundState })),
    } as any;

    const handler = new RefundOutboxHandler(prisma, outbox, gateway);

    const results = await Promise.allSettled([
      handler.handleClaimed(eventIdRefund, claimTokenRefund),
      handler.handleClaimed(eventIdRefund, claimTokenRefund),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(submitRefundCalls).toBe(1);
    expect(updateManyCallCount).toBe(3);
    expect(gateway.submitRefund).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === 'rejected').length).toBe(0);
  });
});

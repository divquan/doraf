/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/unbound-method -- test mocks use any and jest.fn without await */
import { CloudTasksOutboxDispatcher } from './cloud-tasks-outbox.dispatcher';
import type { CloudTasksOutboxPublisher } from './cloud-tasks-outbox.publisher';
import type { OutboxService } from './outbox.service';

describe('CloudTasksOutboxDispatcher', () => {
  it('marks accepted task QUEUED, reschedules rejected task, and continues batch', async () => {
    const events = [
      { id: 'event-1', eventType: 'REFUND_SUBMISSION_REQUIRED' },
      { id: 'event-2', eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED' },
      { id: 'event-3', eventType: 'PRODUCT_PRICING_POLICY_CREATED' },
    ];

    const markQueued = jest.fn(async () => true);
    const reschedule = jest.fn(async () => {});
    const claimAvailableForEventTypes = jest.fn(async () => events as never);
    const outbox = {
      claimAvailableForEventTypes,
      markQueued,
      reschedule,
    } as unknown as OutboxService;

    const publisher = {
      publish: jest.fn(async (input: { eventId: string }) => {
        if (input.eventId === 'event-2') {
          throw new Error('Cloud Tasks publish failed - unavailable');
        }
        // Verify minimal body not containing secrets: already verified in publisher spec, but also ensure no secret leakage here
        // The dispatcher delegates to publisher, body checked in publisher; here we just ensure publish called with correct shape
        expect(input).toEqual(
          expect.objectContaining({
            eventId: expect.any(String),
            claimToken: expect.any(String),
            eventType: expect.any(String),
          }),
        );
        expect(input).not.toHaveProperty('payload');
      }),
    } as unknown as CloudTasksOutboxPublisher;

    const dispatcher = new CloudTasksOutboxDispatcher(outbox, publisher);

    const count = await dispatcher.publishPending();

    expect(count).toBe(3);
    expect(claimAvailableForEventTypes).toHaveBeenCalledTimes(1);
    // Check batch size param is 25 and event types includes informational
    const claimArgs = (claimAvailableForEventTypes as any).mock.calls[0];
    expect(claimArgs[0]).toBe(25);
    expect(typeof claimArgs[1]).toBe('string'); // claimToken
    expect(Array.isArray(claimArgs[2])).toBe(true);

    expect(publisher.publish).toHaveBeenCalledTimes(3);
    expect(markQueued).toHaveBeenCalledTimes(2);
    expect(markQueued).toHaveBeenCalledWith('event-1', expect.any(String));
    expect(markQueued).toHaveBeenCalledWith('event-3', expect.any(String));
    expect(markQueued).not.toHaveBeenCalledWith('event-2', expect.any(String));

    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(reschedule).toHaveBeenCalledWith(
      'event-2',
      expect.any(String),
      expect.objectContaining({
        error: expect.stringContaining('Cloud Tasks publish failed'),
      }),
    );
    const rescheduleError = (
      (reschedule as any).mock.calls[0][2] as { error: string }
    ).error;
    expect(rescheduleError.length).toBeLessThanOrEqual(500);
  });

  it('does not put secrets or full contact values in task body', async () => {
    const events = [
      { id: 'event-secret', eventType: 'PAYMENT_INITIALIZATION_REQUESTED' },
    ];
    const outbox = {
      claimAvailableForEventTypes: jest.fn(async () => events as never),
      markQueued: jest.fn(async () => true),
      reschedule: jest.fn(async () => {}),
    } as unknown as OutboxService;

    let capturedBody: Record<string, unknown> | null = null;
    const publisher = {
      publish: jest.fn(
        async (input: {
          eventId: string;
          claimToken: string;
          eventType: string;
        }) => {
          capturedBody = {
            eventId: input.eventId,
            claimToken: input.claimToken,
            eventType: input.eventType,
          };
          expect(input).not.toHaveProperty('payload');
          expect(input).not.toHaveProperty('phone');
          expect(input).not.toHaveProperty('email');
        },
      ),
    } as unknown as CloudTasksOutboxPublisher;

    const dispatcher = new CloudTasksOutboxDispatcher(outbox, publisher);
    await dispatcher.publishPending();

    expect(capturedBody).not.toBeNull();
    expect(Object.keys(capturedBody!).sort()).toEqual([
      'claimToken',
      'eventId',
      'eventType',
    ]);
  });

  it('includes DELIVERY_MESSAGE_REQUESTED for all environments (router handles production guard)', async () => {
    const claimAvailableForEventTypes = jest.fn(async () => [] as never);
    const outbox = {
      claimAvailableForEventTypes,
      markQueued: jest.fn(),
      reschedule: jest.fn(),
    } as unknown as OutboxService;
    const publisher = {
      publish: jest.fn(),
    } as unknown as CloudTasksOutboxPublisher;
    const dispatcher = new CloudTasksOutboxDispatcher(outbox, publisher);
    await dispatcher.publishPending();
    const eventTypes = (claimAvailableForEventTypes as unknown as jest.Mock)
      .mock.calls[0][2] as string[];
    expect(eventTypes).toContain('DELIVERY_MESSAGE_REQUESTED');
  });
});

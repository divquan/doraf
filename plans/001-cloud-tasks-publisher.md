# Plan 001: Replace Redis publication with a Cloud Tasks outbox publisher

> **Executor instructions**: This plan adds the Cloud Tasks publication path
> while preserving PostgreSQL as the source of truth. Follow the steps in
> order. Do not modify agent OTP delivery. Do not add a Redis compatibility
> path. Stop on the conditions below instead of inventing a second queue
> abstraction.

> **Drift check (run first)**: `git diff --stat 3bfad014..HEAD -- apps/api/src apps/api/package.json pnpm-lock.yaml`.
> If any listed file has changed, compare the current symbols below with the
> live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `3bfad014`, 2026-08-31

## Why this matters

The current API writes durable PostgreSQL outbox events, but immediate
publication is implemented by a Redis Stream dispatcher. A continuous Redis
consumer cannot be request-triggered by Cloud Run and therefore does not meet
the scale-to-zero deployment decision. This part creates the Cloud Tasks
publisher while retaining the existing claim token and outbox lease semantics,
so a crash or duplicate task remains recoverable and idempotent.

## Current state

- `apps/api/src/operations/outbox.service.ts:33-109` claims pending events in
  PostgreSQL with `FOR UPDATE SKIP LOCKED`, increments `attempt_count`, and
  assigns a UUID claim token and lease.
- `apps/api/src/operations/outbox.service.ts:111-168` transitions claimed
  events to `DISPATCHED`, `QUEUED`, or rescheduled `PENDING`/`FAILED`.
- `apps/api/src/operations/redis-outbox.dispatcher.ts:41-95` currently claims
  events, publishes `{ eventId, claimToken, eventType }` to Redis, then marks
  the event `QUEUED`; publication errors reschedule the PostgreSQL event.
- `apps/api/src/operations/outbox-event-types.ts:1-24` contains the event list
  used by the Redis path. Preserve the event routing behavior, but remove the
  Redis-specific names and exports.
- `apps/api/src/config/environment.ts:68-73,255-280` currently makes Redis
  the default provider and requires `REDIS_URL` when Redis is selected.
- `apps/api/package.json:48-50` includes the Redis dependency but no Google
  Cloud Tasks client.

The repository convention is NestJS dependency injection with configuration
validated centrally in `apps/api/src/config/environment.ts`. Database effects
are performed through `PrismaService` and `OutboxService`; external calls are
outside PostgreSQL transactions.

## Target behavior

1. The API commits business state and its outbox event in one PostgreSQL
   transaction, as it does today.
2. A request-driven publisher claims a bounded batch from PostgreSQL.
3. For each claim it creates one Cloud Task whose body contains only:
   `eventId`, `claimToken`, and `eventType`.
4. After Cloud Tasks accepts the task, the publisher marks the event `QUEUED`.
5. If task creation fails, the publisher reschedules the claim with a safe
   error and does not mark it queued.
6. The task name is deterministic for the event and claim token, so a retry of
   the same publication attempt cannot create an accidental duplicate task.
   A new claim after lease recovery gets a new token and may use a new task
   name.
7. Cloud Tasks receives an authenticated target URL, OIDC service-account
   email, and explicit audience from validated configuration; none are
   hard-coded.

Do not put payload JSON, voucher values, OTPs, phone numbers, email addresses,
provider secrets, or decrypted contacts in the task body.

## Commands you will need

| Purpose                     | Command                                              | Expected result                                   |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------- | --------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| API typecheck               | `pnpm --filter @dashchecker/api typecheck`           | exit 0                                            |
| API build                   | `pnpm --filter @dashchecker/api build`               | exit 0 and `dist` contains the compiled publisher |
| API tests                   | `pnpm --filter @dashchecker/api test -- --runInBand` | all tests pass                                    |
| Search old queue references | `rg -n "RedisOutbox                                  | REDIS_OUTBOX                                      | REDIS_URL | QUEUE_PROVIDER" apps/api/src apps/api/package.json` | only intentional removal work remains; final zero matches is required by Plan 003 |

## Scope

In scope:

- `apps/api/package.json`
- `pnpm-lock.yaml`
- `apps/api/src/config/environment.ts`
- `apps/api/src/operations/outbox-event-types.ts`
- `apps/api/src/operations/outbox.service.ts` only if a small publication
  helper is needed
- new Cloud Tasks publisher/configuration files under
  `apps/api/src/operations/`
- API composition wiring needed to inject the publisher
- focused publisher/configuration tests

Out of scope:

- Agent OTP delivery and `SmsOtpSender`.
- Cloud Tasks HTTP consumer implementation; that is Plan 002.
- Deleting Redis worker files; that is Plan 003.
- Cloud IAM, queue creation, Dockerfiles, or live deployment; that is Plan 004.
- Changing domain handlers or PostgreSQL state-machine semantics.

## Steps

### Step 1: Add the Cloud Tasks client and validated configuration

Add the supported Google Cloud Tasks Node client as a direct runtime
dependency, update the lockfile using the repository package manager, and add
configuration fields for:

- project ID,
- queue location,
- queue name,
- task target URL,
- task OIDC service-account email, and
- task audience.

Use a boolean or equivalent explicit local/test switch only if needed to avoid
requiring live Google credentials in unit tests. Production configuration must
fail validation when any Cloud Tasks value required for publication is absent.
Do not retain `QUEUE_PROVIDER` as a Redis/Postgres choice. The application has
one hosted immediate queue: Cloud Tasks. Keep local development behavior
explicit rather than silently falling back to Redis.

**Verify**: `pnpm --filter @dashchecker/api typecheck` -> exit 0; add or update
configuration tests for missing/invalid Cloud Tasks values -> all pass.

### Step 2: Implement an injected publisher

Create a small `CloudTasksOutboxPublisher` (or an equivalently named service)
under `apps/api/src/operations/`. Its public operation should accept an
outbox event ID, claim token, event type, and create the task. Construct the
Cloud Tasks queue path with the official client, encode the minimal JSON body,
set the configured HTTP target, and set OIDC authentication using the
configured service account and audience.

Use a task name derived from the event ID and claim token. Do not use a random
name. Map the provider's already-exists response for the same deterministic
task name as successful publication only when it is provably the same task
identity; otherwise surface the error for rescheduling. Keep provider error
details out of client responses and truncate safe persisted errors consistently
with `OutboxService`.

**Verify**: add a publisher test with a fake injected Cloud Tasks client that
asserts the exact queue path, deterministic task name, minimal body, target
URL, OIDC service account, and audience. Add a failure case that propagates a
provider error without marking PostgreSQL state dispatched. The test must
inspect the client request shape; it must not merely assert that a mocked
method was called.

### Step 3: Replace the Redis dispatch algorithm with Cloud Tasks publication

Add a request-safe/bounded publication operation that follows the existing
Redis dispatcher algorithm:

- claim at most the existing bounded batch size,
- create a Cloud Task for each event,
- mark that event `QUEUED` only after acceptance,
- reschedule only the failed publication claim, and
- ensure one failed event does not prevent later claimed events from being
  attempted unless the database/Cloud Tasks client is globally unavailable.

The event list must preserve the current behavior for all event types routed
through `REDIS_OUTBOX_EVENT_TYPES`, including informational events. Plan 002's
consumer will mark informational events dispatched without invoking an
external provider, matching `RedisOutboxConsumer`.

Expose this operation so the API can publish after a commit when appropriate,
and so Plan 004's scheduled outbox-repair job can call the same bounded
operation. Do not call Cloud Tasks inside a database transaction.

**Verify**: add a focused integration-style service test using an in-memory
fake Cloud Tasks boundary and a real mocked `OutboxService` state transition:
one accepted task leads to `QUEUED`, one rejected task leads to rescheduled
`PENDING`, and a batch continues to the next event. Also verify no task body
contains a secret or full contact value.

### Step 4: Wire the publisher into API and job composition

Register the publisher in `OperationsModule` and inject it into the API-side
publication hook used after durable outbox commits. Cloud Tasks cannot poll
PostgreSQL, so this hook is required for fast delivery; it is not optional
because the repair job exists. Inventory every `outbox.enqueue` caller with
`rg -n "outbox\.enqueue\(" apps/api/src` and ensure each top-level request or
webhook path invokes the shared bounded publisher after its transaction
resolves. Do not put the Cloud Tasks call inside the transaction. If the
current code has no centralized hook, add a small operations-layer helper and
wire it into each owning service's post-commit path rather than adding
different Cloud Tasks request shapes in each domain service.

The post-commit publisher must not make a committed business transaction look
rolled back: if Cloud Tasks is temporarily unavailable, record a safe
application error/metric and let scheduled `outbox-repair` retry it. The
request's business response may already be committed. The repair path covers
crashes after commit and before this hook runs.

Keep the job entrypoint able to invoke bounded outbox repair, but do not yet
remove its Redis imports; Plan 003 performs the complete composition cleanup.

**Verify**: the executor must provide a coverage table in the test/PR notes
listing every current `outbox.enqueue` caller and its post-commit publication
hook. Add a test for a successful business commit followed by failed task
publication: the business state remains committed and the outbox event remains
repairable. `pnpm --filter @dashchecker/api build` -> exit 0; inspect the
compiled module graph or run the focused composition test to prove the API
does not instantiate a Redis client and the publisher is available through
Nest dependency injection.

## Test plan

- Extend `apps/api/src/config/environment.spec.ts` for Cloud Tasks validation.
- Add publisher tests under `apps/api/src/operations/` following the existing
  Nest testing style, but assert request contents and state transitions rather
  than only mock call counts.
- Add a regression test for a publication crash/error between task acceptance
  and `markQueued`: the task payload must remain processable by the consumer
  when the event is still `CLAIMED` (the existing `getClaimedEvent` accepts
  both `CLAIMED` and `QUEUED`).
- Do not add tests for unchanged OTP behavior.

## Done criteria

- [ ] Cloud Tasks is a direct runtime dependency and lockfile is consistent.
- [ ] Production configuration cannot start without the required Cloud Tasks
      queue/target/authentication settings.
- [ ] Publication sends only event ID, claim token, and event type.
- [ ] Accepted tasks transition events to `QUEUED`; failed publication
      reschedules the claim.
- [ ] Deterministic task naming and duplicate acceptance behavior are tested.
- [ ] `pnpm --filter @dashchecker/api typecheck` passes.
- [ ] `pnpm --filter @dashchecker/api build` passes.
- [ ] Focused publisher/configuration tests pass without live Google access.
- [ ] No OTP code or delivery path changed.

## STOP conditions

Stop and report if:

- the current outbox state no longer has `CLAIMED`/`QUEUED` semantics;
- a domain service currently publishes before its owning transaction commits;
- Cloud Tasks client authentication requires a credential value in source or
  a test fixture;
- adding the publisher requires changing a financial handler or its state
  machine; or
- the executor cannot establish whether an already-exists Cloud Tasks error
  refers to the same deterministic task.

## Maintenance notes

The publisher is infrastructure glue, not a domain handler. Future queue
changes should implement the same minimal task contract and preserve the
PostgreSQL claim token. Reviewers should check that a new event type has a
consumer route and that every external side effect remains outside a database
transaction.

# Plan 002: Add the private Cloud Tasks HTTP consumer

> **Executor instructions**: Build the request-driven Cloud Run task consumer
> for the publisher from Plan 001. It must authenticate Cloud Tasks, reload
> canonical state from PostgreSQL, dispatch through existing handlers, and use
> HTTP status codes that produce safe Cloud Tasks retry behavior. Do not add
> agent OTP delivery here.

> **Drift check (run first)**: `git diff --stat 3bfad014..HEAD -- apps/api/src apps/api/package.json pnpm-lock.yaml`.
> Confirm that Plan 001 exists and its publisher contract is the live contract
> before changing consumer code.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-cloud-tasks-publisher.md`
- **Category**: migration
- **Planned at**: commit `3bfad014`, 2026-08-31

## Why this matters

Cloud Tasks only provides delivery; the application still needs a private
HTTP endpoint that authenticates the platform identity and applies the event
once or safely handles a duplicate. The existing Redis consumer contains the
important routing rules, but it is tied to a blocking Redis Stream and a
continuous process. This part moves those routing rules behind an HTTP
boundary without changing the existing domain handlers.

## Current state

- `apps/api/src/operations/redis-outbox.consumer.ts:68-154` claims pending
  Redis messages, reloads the PostgreSQL event with its claim token, routes
  informational/pricing/refund/withdrawal/delivery events, acknowledges
  terminal work, and defers retryable failures.
- `apps/api/src/operations/outbox.service.ts:249-264` reloads only the event
  type/state for a matching event ID and claim token; a missing or already
  dispatched event is naturally safe to treat as an idempotent duplicate.
- `apps/api/src/pricing/pricing-outbox.handler.ts`,
  `apps/api/src/refunds/refund-outbox.handler.ts`,
  `apps/api/src/wallet/withdrawal-outbox.handler.ts`, and
  `apps/api/src/delivery/delivery-outbox.handler.ts` already own domain
  processing and call `markDispatched` or `reschedule`.
- `apps/api/src/app.module.ts` is the public HTTP composition root and
  intentionally does not import the worker-only providers.
- `apps/api/src/main.ts:7-15` configures the public API listener. There is no
  task HTTP controller or OIDC verification code today.

## Target behavior

Create a separately deployable task-consumer entrypoint and module. It may
share the Nest domain modules and handler classes, but it must not start
continuous polling timers.

The endpoint should accept a minimal JSON body:

```json
{ "eventId": "uuid", "claimToken": "uuid", "eventType": "string" }
```

It must:

1. Require a bearer identity token from Cloud Tasks.
2. Verify the token signature, issuer, audience equal to the configured task
   audience, and email equal to the configured Cloud Tasks service account.
3. Validate the body shape and reject unknown fields.
4. Reload the outbox event by `eventId` and `claimToken`; do not trust the body
   event type over PostgreSQL.
5. Return `2xx` for successfully handled events, already-dispatched/stale
   tasks, informational events, and permanent failures recorded as `FAILED`.
6. Return non-`2xx` only for a failure Cloud Tasks should retry, such as a
   transient database/provider error that the handler has not already
   rescheduled.
7. Never return stack traces, provider payloads, OTPs, voucher values, or
   decrypted contacts in the response.

For an event that was accepted by Cloud Tasks but whose publisher crashed
before `markQueued`, the endpoint must still process a matching event in
`CLAIMED` state. For a stale task whose claim token no longer matches, return
`2xx` and log a safe stale-task outcome; the scheduled repair path will publish
the current claim.

## Scope

In scope:

- new task-consumer controller, module, and HTTP entrypoint under
  `apps/api/src/`
- OIDC verification service and validated configuration additions
- a shared outbox task router extracted from the Redis consumer's routing rules
- focused HTTP/authentication/idempotency tests
- composition changes needed for the task consumer to use existing handlers

Out of scope:

- Redis deletion; Plan 003 owns that cleanup.
- Cloud Run IAM and queue provisioning; Plan 004 owns deployment.
- changing financial, delivery, or pricing handler business logic.
- Agent OTP delivery.

## Steps

### Step 1: Extract a queue-independent outbox task router

Move the routing logic from `RedisOutboxConsumer.dispatch` into a service that
accepts `{ eventId, claimToken }`, reloads the event through PostgreSQL, and
routes using the event type from the database. Preserve these routes exactly:

- informational event types -> `markDispatched`;
- pricing activation types -> `PricingOutboxHandler.handleClaimed`;
- `REFUND_SUBMISSION_REQUIRED` -> refund handler;
- `WITHDRAWAL_SUBMISSION_REQUIRED` -> withdrawal handler;
- `DELIVERY_MESSAGE_REQUESTED` -> delivery handler, subject to the existing
  production gateway guard;
- unknown event type -> terminal `FAILED`/safe error, matching current
  behavior.

The router must be usable by an HTTP controller and must not know anything
about Redis, HTTP status codes, or Cloud Tasks SDK types.

**Verify**: focused router tests cover one route for each current event class,
an already-dispatched event, a stale claim token, and an unknown event. Tests
must assert PostgreSQL-facing state transitions or handler results, not only
that a branch was entered.

### Step 2: Implement OIDC authentication and request validation

Add a service that verifies Google-signed identity tokens against the exact
configured audience and expected service account. Use a maintained Google auth
library as a direct dependency; do not rely on a transitive package. Cache
public-key metadata according to the library's normal behavior and do not
implement ad hoc signature verification.

Use a DTO/class-validator contract consistent with the API's global
`ValidationPipe` (`whitelist` and `forbidNonWhitelisted` are enabled in
`apps/api/src/configure-application.ts`). Reject missing/invalid bearer tokens
with `401` and valid tokens from the wrong principal/audience with `403`.

**Verify**: unit tests cover missing token, malformed token, wrong audience,
wrong service-account email, expired token, and valid token. Use signed test
tokens or a verifier seam; never place a real credential or private key in the
repository. The tests must prove the controller does not call the router when
authentication or validation fails.

### Step 3: Build a separate HTTP task-consumer composition root

Create a task-consumer module that imports the database, operations, and domain
modules required by the existing handlers and registers only the task router,
OIDC verifier, and controller. Do not import continuous polling workers.

Create a task entrypoint that listens on `0.0.0.0:${PORT}` and exposes only
the internal task route plus a health/readiness route appropriate for Cloud
Run. Keep the task route under a clearly internal path and ensure it is not
listed as a public client API contract.

Translate router outcomes into Cloud Tasks semantics. If a handler has already
recorded a retryable state and returned normally, acknowledge with `204` or
`200`; if an unhandled transient error escapes, return `500` so Cloud Tasks
retries it. If the event is stale or terminal, return `204`.

**Verify**: HTTP integration tests boot the task composition root with a fake
OIDC verifier and a controlled router. They must prove valid requests return
success, invalid identity returns `401/403`, malformed body returns `400`,
router transient exception returns `5xx`, and stale/terminal work returns
`2xx`. Also prove the task app does not open Redis or start a polling timer.

### Step 4: Preserve duplicate safety

Add a regression test that submits the same valid task payload twice. The first
submission may dispatch the handler; the second must produce no duplicate
financial, inventory, delivery-attempt, or informational effect. Use existing
database integration test patterns where available; do not mock the state
machine into existence.

Review each handler's return/error behavior before choosing the HTTP mapping.
If a handler currently swallows an external failure by recording `PENDING`,
`UNKNOWN`, or `FAILED`, preserve that behavior and acknowledge only after the
state is durable.

**Verify**: the duplicate integration test passes against PostgreSQL and the
API/task package tests pass. A duplicate task may be delivered concurrently;
the test should exercise concurrent submission where the relevant database
fixture supports it.

## Test plan

- Add controller/auth tests under a task-consumer test file.
- Add router tests that reuse existing handler fixtures and assert durable
  state transitions.
- Add one database integration test for duplicate delivery on a safe
  non-payment event and one for an event already marked `DISPATCHED`.
- Do not add tests that simply assert a function returns the value hard-coded
  in the fake dependency.

## Done criteria

- [ ] A separately deployable HTTP task consumer exists.
- [ ] Cloud Tasks identity token and audience/principal are verified.
- [ ] The request body is minimal and validated.
- [ ] All current Redis consumer routes have queue-independent equivalents.
- [ ] Stale and duplicate tasks return safely without duplicate effects.
- [ ] Unhandled retryable failures return non-`2xx`; durable reschedules and
      terminal outcomes return `2xx`.
- [ ] The task app starts no Redis client and no continuous polling worker.
- [ ] API typecheck, build, and focused tests pass.

## STOP conditions

Stop and report if:

- an existing handler cannot distinguish durable retry scheduling from an
  unhandled transient error;
- OIDC verification would require accepting any Google service account or any
  audience;
- a task route must be made public to work around missing Cloud Run IAM;
- duplicate delivery can create a second financial/inventory effect without a
  schema or handler change; or
- extracting the router changes a domain state transition beyond the current
  Redis consumer behavior.

## Maintenance notes

The task endpoint is an infrastructure boundary. Every new outbox event type
must be routed explicitly, tested for duplicate delivery, and assigned a clear
Cloud Tasks response policy. Keep provider reconciliation in the existing
scheduled jobs; a successful task acknowledgement is not proof that an SMS,
email, payment, refund, or transfer was ultimately delivered or settled.

# Serverless Readiness Report — Dashchecker API

**Date:** 2026-09-01
**Scope:** `apps/api` implementation, configuration, Prisma schema/migrations, dependencies, and executable verification commands.  
**Method:** The findings below are based on source and runtime inspection. Project Markdown was compared for consistency, but it was not used as evidence for the findings.  
**Verdict:** **Do not deploy the current API as scale-to-zero serverless.** The HTTP request path can be adapted to serverless, but the current process contains background workers and has unresolved financial recovery, production integration, authorization, and rate-limit problems.  
**Confidence:** High for the blockers listed below.

## 1. Executive summary

The application is a NestJS API backed by Prisma/PostgreSQL. Its durable-data design is a useful foundation: business mutations use database transactions, the schema contains important uniqueness and foreign-key constraints, payment webhooks use the raw request body for signature verification, and outbox rows use database claims with `FOR UPDATE SKIP LOCKED`.

That foundation does not make the application serverless-ready. The HTTP process is now isolated from background work, immediate outbox work is published through Cloud Tasks, and bounded Cloud Run Job entrypoints run one scheduled pass and exit. Production delivery still requires a real provider adapter, and the deployment still needs authenticated queue/job resources and database-backed verification.

The correct conclusion is therefore:

1. Fix the financial and production correctness issues first.
2. Move background work out of the HTTP process.
3. Add a durable queue or a deliberately operated worker runtime.
4. Configure database connections and rate limiting for multiple instances.
5. Prove recovery using integration and failure-injection tests that exercise business outcomes.

This is not only a deployment-wiring change. Payment recovery, refund recovery, outbox leases, agent authorization, and delivery failure handling require application changes.

### Implementation update — 2026-09-01

The Plan 002/003 implementation slice is now reflected in the runtime:

- Cloud Tasks is the sole immediate outbox dispatcher; delivery events are published in every environment and reach the authenticated task router. If production delivery is not configured, the router records a terminal configuration failure instead of leaving the event pending or using the development gateway.
- Redis adapters, the continuous worker process, and polling outbox workers have been removed. `start:job` exposes bounded `outbox-repair`, reconciliation, lease-recovery, invariant-audit, and `all` jobs.
- Refund concurrency coverage uses deferred promises and the real handler path; it does not synchronize with timers or copy the production claim predicate.
- Honest API lint has no remaining inline suppressions or findings. Database-backed suites still require `TEST_DATABASE_URL` and are not claimed as verified without it.

The remaining production delivery adapter and platform deployment evidence are outside this implementation slice.

### Previous implementation update — 2026-08-30

The first implementation slice for F-01 through F-03 is now in the working tree:

- F-01: `AppModule` no longer registers worker providers. `WorkerAppModule` and `start:worker` provide a separate continuous worker process. `job-main.ts` and `start:job` provide allowlisted bounded job entrypoints with `WORKER_EXECUTION=run-once`; timers are enabled only for continuous workers.
- F-02: Redis Streams dispatch is implemented behind `QUEUE_PROVIDER=redis`. The Postgres outbox remains the source of truth; a worker claims rows, publishes `{eventId, claimToken, eventType}`, marks them `QUEUED`, and a consumer acknowledges the Redis message only after the database handler finishes. Local Compose enables Redis AOF. Managed Redis operation, alerting, and failure-path verification remain.
- F-03: the contradictory payment initialization claim predicate is corrected and covered by a database outcome test proving `RECONCILING / INITIATION_UNCONFIRMED` attempts can be reclaimed without changing their payment reference or reservation.

That implementation slice was not a serverless approval. Production scheduler resources and authenticated invocation still need to be configured. F-03's identified predicate defect is now verified against the database; the maximum payment-retry policy remains a separate open product decision.

## 2. Current runtime facts

### 2.1 HTTP process

`apps/api/src/main.ts` starts a normal NestJS listener with `app.listen()`. `apps/api/src/job-main.ts` is the bounded scheduled-job entrypoint: it accepts only an allowlisted `JOB_NAME`, runs one pass, closes the application context, and exits non-zero when a run-once worker reports failure. Immediate outbox work is delivered by authenticated Cloud Tasks requests to the task-consumer route.

`apps/api/src/configure-application.ts` configures URI versioning, strict validation, request logging, shutdown hooks, and proxy trust. Webhook handling depends on `rawBody: true` in `main.ts`; any serverless adapter must preserve the exact request bytes before parsing JSON.

### 2.2 Background workers

The following work runs in the API only when invoked by a Cloud Tasks request or a bounded job. The API does not register polling timers.

| Work                        | Invocation                                      | Consequence of no invocation                         |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Immediate outbox dispatch   | Cloud Tasks request plus `outbox-repair` job     | Committed outbox work remains pending.               |
| Payment initialization      | `payment-initialization` bounded job             | Initialization recovery waits.                       |
| Payment reconciliation      | `payment-reconciliation` bounded job             | Provider confirmation waits.                         |
| Delivery outbox             | Cloud Tasks task-consumer route                  | Delivery remains pending or is terminally failed when no provider is configured. |
| Refund reconciliation       | `refund-reconciliation` bounded job              | Unknown refunds wait for provider lookup.            |
| Withdrawal reconciliation   | `withdrawal-reconciliation` bounded job          | Unknown transfer outcomes wait.                      |
| Outbox lease recovery       | `lease-recovery` bounded job                     | Expired claims remain stranded.                      |
| Invariant auditing          | `invariant-audit` bounded job                    | Drift detection waits.                               |

`timer.unref()` only affects Node.js event-loop behavior. It does not keep a serverless instance alive and does not provide a scheduler.

### 2.3 Database connections

`apps/api/src/database/prisma.service.ts` creates `PrismaPg` from `DATABASE_URL`, but the application does not configure the underlying pool size in code. A serverless deployment must explicitly bound connections per instance and calculate the total against the database provider's connection budget.

`DIRECT_URL` is used by Prisma configuration for migration operations. It must remain separate from the runtime connection URL where a transaction pooler is required.

## 3. Findings and concrete remediation

### F-01 — Background work must be isolated from the HTTP process

**Category:** Architecture / serverless suitability  
**Status:** Application HTTP/worker split and bounded scheduled-job extraction complete; platform scheduling and queue-trigger deployment remain.
**Impact:** The HTTP process no longer starts polling timers. Scheduled work runs as bounded Cloud Run Jobs, while immediate outbox work is delivered through Cloud Tasks.
**Effort:** L  
**Fix risk:** Medium — deployment and module-boundary changes affect every asynchronous workflow.  
**Confidence:** High.

**Evidence:** `apps/api/src/worker-app.module.ts` registers bounded-job providers separately from `apps/api/src/app.module.ts`; `apps/api/src/job-main.ts` runs an allowlisted job once; `WORKER_EXECUTION=run-once` prevents timer startup; `apps/api/src/operations/cloud-tasks-outbox.dispatcher.ts` publishes immediate work.

**Remaining fix:** Configure Cloud Scheduler and Cloud Run Jobs for the bounded job names, authenticate invocation with Cloud IAM, and configure the Cloud Tasks queue and task-consumer route. The concrete deployment checklist is tracked in [`docs/planning/deployment-todo.md`](../planning/deployment-todo.md).

The API and bounded jobs can use the same container image with different entrypoints or configuration, but they must be separate processes. Cloud Run IAM must protect job invocation, and every queue/job handler must be safe to execute more than once.

### F-02 — The durable outbox needs production operation and failure verification

**Category:** Reliability  
**Status:** Cloud Tasks dispatcher and authenticated task-consumer route implemented; platform deployment and provider delivery remain.
**Impact:** Outbox rows survive API termination and are published by ID plus claim token. Delivery requires a configured production provider; missing configuration is recorded as an explicit terminal failure.
**Effort:** L  
**Fix risk:** High — changing dispatch timing can expose duplicate processing and ordering assumptions.  
**Confidence:** High.

**Evidence:** `apps/api/src/operations/cloud-tasks-outbox.dispatcher.ts` claims eligible Postgres rows and publishes authenticated Cloud Tasks requests containing the outbox ID and claim token; `apps/api/src/operations/outbox-task.router.ts` reloads and validates the claim before routing; `outbox.service.ts` records `QUEUED`/`DISPATCHED` and terminal failures.

**Current implementation:** Keep the transactional outbox as the source of truth:

1. Create the outbox row in the same transaction as the business mutation.
2. Claim it with a lease.
3. Publish a Cloud Tasks request containing the outbox ID and claim token.
4. Mark it `QUEUED` after Cloud Tasks accepts the request; mark it `DISPATCHED` only after the task handler completes the database handler.
5. Let the bounded lease-recovery job reclaim claims stranded before publication is recorded.
6. Let the bounded `outbox-repair` job republish eligible pending work.
7. Make the task consumer idempotent so duplicate delivery is harmless.

**Remaining fix:** Provision Cloud Tasks with authenticated OIDC requests, retry/rate/dead-letter policy, monitoring, and an explicit recovery procedure. Add failure-path integration tests for API termination after the transaction, task delivery after `QUEUED`, duplicate task delivery, provider ambiguity, and stale Postgres claims.

Do not mark an event dispatched merely because a handler started. Do not rely on a best-effort post-transaction queue call without a repair path; a process can die between the commit and that call.

### F-03 — Payment initialization recovery had an impossible condition

**Category:** Financial correctness  
**Status:** Complete for the identified predicate defect and recovery path; maximum payment-retry policy remains a separate open product decision.
**Impact:** Before the fix, an ambiguous provider initialization was excluded from the recovery claim query and could remain in `RECONCILING` indefinitely. The buyer may have been charged or the provider may have created a payment while the local order remained incomplete.
**Effort:** M  
**Fix risk:** High — payment states and provider retries must remain idempotent.  
**Confidence:** High.

**Evidence:** `apps/api/src/payments/payment-processing.service.ts` now uses explicit `CREATED` and `RECONCILING / INITIATION_UNCONFIRMED` branches. `apps/api/test/database-orders.e2e-spec.ts` creates an ambiguous attempt, makes it due, runs the real initialization worker, and asserts the original attempt, provider reference, reservation, and reserved voucher are preserved while the attempt reaches `PENDING_AUTHORIZATION`.

**Fix:** Replace the contradictory predicate with explicit state-specific branches:

```text
(state = CREATED and initializable provider status)
or
(state = RECONCILING and providerStatus = INITIATION_UNCONFIRMED)
```

When the second branch is reclaimed, preserve the same payment attempt, merchant reference, order, and inventory reservation. Transition it through a valid retry state rather than creating a new payment attempt. The maximum number of payment retries is not silently chosen here; it remains an open product decision recorded in the checkout flow documentation.

### F-04 — Refund submission is not crash- or ambiguity-safe

**Category:** Financial correctness  
**Status:** Application recovery path complete; live-provider failure exercise remains a deployment verification item.
**Impact:** A crash after local state changes but before the provider result can leave a refund permanently stuck. Retrying blindly can also create duplicate refunds where the provider accepted the first request.

**Effort:** L  
**Fix risk:** High — refunds require conservative handling of unknown provider outcomes.  
**Confidence:** High.

**Evidence:** `apps/api/src/refunds/refund-outbox.handler.ts` persists `SUBMITTING`, a stable `submissionKey`, and an attempt count before the provider call. Ambiguous outcomes remain `PENDING`; the outbox is rescheduled, and reconciliation looks up `SUBMITTING`, legacy `SUBMITTED`, and `PENDING` refunds without requiring a stored provider reference. `apps/api/test/database-orders.e2e-spec.ts` proves that a timeout followed by provider visibility reaches one successful refund while the provider submission is called once. Paystack's refund API does not expose a request idempotency-key parameter, so the lookup uses the stable merchant note, transaction identity, amount, and currency before any retry.

**Fix implemented:**

1. Introduce an explicit `SUBMITTING` or equivalent state.
2. Persist a stable internal submission key before the provider call.
3. Keep the outbox operation retryable until the outcome is known.
4. Treat timeout and connection failures as ambiguous, not successful or definitively failed.
5. Reconcile ambiguous refunds even when no provider reference was stored.
6. Use provider idempotency if supported. If it is not supported, reconcile using the strongest provider-visible identifiers before attempting another submission.
7. Store the provider response, last error, retry count, and next retry time.

The handler is safe to replay after the local pre-submit write, after an ambiguous provider response, and after a database failure following provider acceptance. A live Paystack sandbox termination test is still required before production approval.

### F-05 — Outbox lease recovery is incomplete and manual requeue is unsafe

**Category:** Reliability / financial correctness  
**Status:** Complete for application behavior; deployment scheduling and operational alerting remain.
**Impact:** A crashed worker can strand a financial event in `CLAIMED`. The manual requeue path can also requeue an actively running old event, causing duplicate external side effects.

**Effort:** M  
**Fix risk:** High — incorrect lease recovery can duplicate payments, refunds, or withdrawals.  
**Confidence:** High.

**Evidence:** `apps/api/src/operations/outbox.service.ts` writes `lease_until` on every claim and reclaims only expired `CLAIMED`/`QUEUED` rows with `FOR UPDATE SKIP LOCKED`. Reclamation clears `claimed_at`, `lease_until`, and `claim_token`, records bounded retry availability, and the admin repair path writes `OUTBOX_CLAIM_REQUEUED` audit events. `apps/api/test/database-orders.e2e-spec.ts` proves an expired lease is reclaimed with claim metadata cleared.

**Fix implemented:** Centralize claim recovery:

- Use `claimedAt` or, preferably, an explicit `leaseUntil` timestamp.
- Set the lease longer than the maximum provider request plus a safety margin.
- Reclaim only expired claims.
- Clear claim token, claim timestamp, and worker identity when reclaiming.
- Increment attempts and calculate bounded backoff.
- Run repair independently of the API process.
- Restrict manual requeue to expired claims and require an audit record.

The repair path no longer requeues a row solely because it was created long ago; pending work is inspected by availability time, while claimed/queued work is inspected by lease expiry.

### F-06 — Scheduled pricing events require durable routing and idempotency

**Category:** Correctness  
**Status:** Complete for durable routing and activation replay behavior; deployment scheduling remains.
**Impact:** A future product or agent price can fail to activate, causing customers to see or pay the wrong price.

**Effort:** S/M  
**Fix risk:** Medium — event routing changes can affect pricing transitions.  
**Confidence:** High.

**Evidence:** `apps/api/src/pricing/pricing-outbox.handler.ts` validates the event type and claim; `apps/api/src/operations/outbox-task.router.ts` routes the task to it; `apps/api/src/pricing/pricing.service.ts` ignores stale activation events and makes repeated activation a no-op after the intended effective price is present. `apps/api/test/database-pricing.e2e-spec.ts` proves the persisted price/version is unchanged on replay.

**Fix implemented:** Route pricing activation events through the transactional outbox dispatcher and Cloud Tasks task router. The existing database uniqueness rule prevents duplicate activation events for one aggregate/version, while the handler and pricing service reject stale windows and make re-running an activation a no-op after the intended effective state is present.

### F-07 — Production delivery is not wired

**Category:** Production readiness  
**Impact:** A completed payment can produce a delivery request that is never sent. This can leave the customer without the purchased voucher or notification.

**Effort:** L  
**Fix risk:** Medium — provider failures and duplicate sends must be handled correctly.  
**Confidence:** High.

**Evidence:** `apps/api/src/delivery/delivery.module.ts` currently provides only a development gateway. Cloud Tasks publishes delivery events in production and `apps/api/src/operations/outbox-task.router.ts` routes them to an explicit terminal configuration failure until a production gateway is configured; it never invokes the development gateway in production.

**Fix:**

1. Define production SMS/email gateway interfaces.
2. Implement provider adapters outside the domain services.
3. Select the adapter through validated configuration.
4. Remove the production-disabled worker behavior.
5. Use the delivery event ID as the provider idempotency key where supported.
6. Persist provider message IDs and delivery outcomes.
7. Retry transient failures and dead-letter permanent failures.
8. Keep local delivery as an explicit development adapter only.

### F-08 — Production agent SMS is unavailable

**Category:** Production readiness  
**Impact:** Agent registration and login OTP delivery fail in production. Buyer recovery can return an accepted-style response while no message is delivered unless failure is made observable and actionable.

**Effort:** M  
**Fix risk:** Medium — changes affect authentication and recovery behavior.  
**Confidence:** High.

**Evidence:** `apps/api/src/agent-access/local-sms-otp.sender.ts` throws when used in production. `apps/api/src/buyer-recovery/buyer-recovery.service.ts` catches delivery failure and returns an accepted response.

**Fix:** Implement a production SMS adapter with provider timeout, retry, delivery status, and secret-manager configuration. Never log OTP values in production. Preserve anti-enumeration responses where required, but persist a failed-delivery state and alert on provider outages. For agent authentication, do not leave a usable challenge in an ambiguous delivery state without a retry or cancellation policy.

### F-09 — Suspended agents retain access

**Category:** Authorization  
**Impact:** Suspending an agent does not reliably revoke access. Existing sessions can continue to read data or mutate storefront/onboarding state.

**Effort:** S/M  
**Fix risk:** Medium — a strict status check can invalidate sessions immediately.  
**Confidence:** High.

**Evidence:** `apps/api/src/agent-access/agent-session.guard.ts` checks session existence, revocation, and expiry, but does not require an active agent status. `agent-auth.service.ts` can create a session during OTP verification without enforcing that status. Storefront and onboarding services do not consistently enforce it themselves.

**Fix:**

- Require `agent.status = ACTIVE` in the session guard.
- Reject OTP verification for suspended agents before session creation.
- Revoke or expire agent sessions in the suspension transaction.
- Add active-status checks in sensitive mutation services as defense in depth.
- Add an audit entry for suspension and session revocation.

### F-10 — Agent OTP routes are not protected by shared rate limiting

**Category:** Abuse prevention / security  
**Impact:** Attackers can request OTPs repeatedly, creating SMS cost and delivery flooding, and can distribute verification attempts across instances.

**Effort:** M  
**Fix risk:** Medium — overly strict limits can lock out legitimate agents.  
**Confidence:** High.

**Evidence:** `apps/api/src/agent-access/agent-auth.controller.ts` exposes registration, login, and verification routes without a throttling guard. `AgentAccessModule` does not configure a shared throttling store.

**Fix:** Apply separate limits to OTP request and verification operations. Key limits by normalized phone, challenge ID, and source IP. Use shared Redis/database storage or an edge rate limiter; in-memory limits are only a local-development safeguard. Add cooldowns, per-challenge attempt caps, and operator-visible provider-abuse metrics.

### F-11 — Webhook processing holds the request open during provider verification

**Category:** Reliability / latency  
**Impact:** A provider verification request can consume the webhook request for up to its timeout. This increases retries and duplicate work during provider or network latency.

**Effort:** M  
**Fix risk:** Medium — acknowledgement timing must preserve webhook durability.  
**Confidence:** High.

**Evidence:** `apps/api/src/paystack-webhooks/paystack-webhook.controller.ts` performs payment processing and provider verification in the webhook request path.

**Fix:** Verify the signature synchronously, then transactionally persist a unique webhook event and an internal processing outbox event. Return success only after durable persistence succeeds. Process provider verification asynchronously. Return a non-success response if persistence fails so the provider can retry.

### F-12 — Unbounded reads and repeated reporting queries

**Category:** Performance / scalability  
**Impact:** Large datasets can cause excessive memory use, slow responses, and serverless timeouts. Reporting and pricing scans can issue repeated queries as data grows.

**Effort:** M  
**Fix risk:** Low/Medium — response contracts and admin UI behavior may change.  
**Confidence:** High for unbounded reads; medium for the cost of each repeated query until measured.

**Evidence:** Unbounded reads exist in `src/orders/order-exceptions.controller.ts`, `src/refunds/refunds.service.ts`, and `src/wallet/withdrawals.service.ts`. Reporting and pricing services contain repeated per-record lookups.

**Fix:** Add cursor pagination and server-side maximum limits, select only required columns, and batch repeated lookups using grouped queries or keyed maps. Move heavy invariant/reporting scans to scheduled jobs. Measure query counts and p95 duration on representative data rather than adding speculative indexes.

## 4. Serverless deployment design

### 4.1 Recommended separation

```text
                 ┌────────────────────┐
HTTP request ───▶│ Stateless API       │
                 │ no polling timers  │
                 └─────────┬──────────┘
                           │ database transaction
                           ▼
                    Transactional outbox
                           │
                 ┌─────────┴──────────┐
                 ▼                    ▼
          Durable queue          Scheduled repair
                 │                    │
                 ▼                    ▼
          Idempotent handlers   Reclaim/retry/sweep jobs
```

The queue and scheduler are deployment adapters, not domain dependencies. The domain should depend on narrow interfaces such as `TaskQueue` and `ObjectStorage`, while Google, AWS, Redis, Postgres, or another provider supplies the adapter.

### 4.2 Queue options

Any of these can work if they provide durable delivery and retry:

- Cloud Tasks or Pub/Sub push.
- SQS or another managed queue.
- Redis Streams with a managed Redis deployment, as implemented by the current worker adapter.
- A dedicated Postgres worker for lower scale, provided it is not confused with scale-to-zero HTTP execution.

The current implementation chooses Cloud Tasks. Keep the interface narrow enough that the provider can later change; do not make domain services depend on the Cloud Tasks SDK.

### 4.3 Scheduled work

Use scheduled jobs for:

- Payment initialization retry and reconciliation.
- Refund reconciliation, including ambiguous refunds without provider references.
- Withdrawal reconciliation.
- Outbox lease repair.
- Pricing activation.
- Invariant auditing.

Scheduled jobs must be bounded, acquire the same database leases as queue handlers, and exit with a failure status when work cannot be safely completed.

Cloud Tasks handles immediate outbox delivery; it does not replace scheduling. The bounded job entrypoint now owns outbox repair, payment/refund/withdrawal reconciliation, lease repair, and invariant scans when invoked by a platform scheduler. Those scheduler resources and their authenticated Cloud Run Job invocations still need to be provisioned and exercised before claiming scale-to-zero readiness.

### 4.4 Database connections

Configure the Prisma driver pool explicitly for the selected hosting model. Keep migration connectivity separate from runtime connectivity. Validate the formula:

```text
maximum API instances × connections per instance
  + worker/job connections
  ≤ database connection budget
```

Do not copy a pool size from this report without load testing. A small pool per serverless instance may be correct, but its effect depends on request concurrency, query duration, and the database pooler.

### 4.5 Internal job authentication

Queue and scheduled-job endpoints must not be unauthenticated public mutation routes. Use the provider's signed identity mechanism where available, or a rotated service credential plus request timestamp/replay protection. Authorize the job type and validate the outbox ID before processing.

### 4.6 Webhook requirements

The serverless ingress must expose:

- The exact raw request body.
- The provider signature header.
- A request timeout that allows durable event persistence.
- A retry behavior that does not acknowledge events lost before persistence.

## 5. Clean implementation sequence

The sequence below deliberately separates business correctness from deployment migration.

### Step 1 — Establish a meaningful failure-path baseline

Run the existing typecheck, Prisma validation, unit suite, and lint. Provision a disposable PostgreSQL database for database-backed tests. Record current state transitions for payments, refunds, withdrawals, outbox events, and webhooks.

Do not add tests that only assert that a timer exists, that a method calls a mocked collaborator, or that an enum maps to itself. Tests added here must demonstrate a business outcome after a failure, retry, duplicate, or concurrent claim.

### Step 2 — Correct payment and refund state machines

F-03 and the application portions of F-04 are implemented in the current slice. The focused database test covers an ambiguous refund with no provider reference and proves one provider submission; a live sandbox termination test remains part of deployment verification. Preserve the following failure-injection coverage as the broader payment/refund release gate:

- provider timeout after accepting a request;
- process termination before the local result is saved;
- duplicate handler delivery;
- webhook and reconciliation racing;
- concurrent workers claiming one attempt;
- ambiguous refund with no provider reference.

The expected assertions must be final business states: exactly one payment result, no duplicate reservation, one refund outcome, or an explicit operator-review state.

### Step 3 — Make outbox leases recoverable

The current slice adds a dedicated expired-claim worker, an explicit lease/backoff policy, audited manual recovery, and idempotent pricing activation in both worker modes. The focused integration tests prove expired-claim reclamation and pricing replay behavior. Deployment still needs scheduler/worker monitoring and a process-termination exercise against the production queue topology.

### Step 4 — Wire production communication providers

Implement F-07 and F-08. Add provider adapters, secret configuration, idempotency, delivery status, retry, and failure alerting. Verify with provider sandbox or a deterministic test double that records duplicate requests by idempotency key; do not assert merely that a gateway method was called.

### Step 5 — Enforce suspension and abuse controls

Implement F-09 and F-10. Add tests that attempt access with an existing session after suspension, attempt new OTP verification after suspension, exceed per-challenge limits, and distribute attempts across separate application instances sharing the same limiter store.

### Step 6 — Move webhook provider work off the request path

Implement F-11. Persist the webhook event and processing intent before acknowledging. Verify duplicate webhook delivery results in one business transition. Verify database failure produces a retryable webhook response.

### Step 7 — Extract workers from the API and dispatch durable outbox work

The current slice implements F-01's application boundary: callable worker methods, a separate bounded-job composition root, an allowlisted `start:job` entrypoint, and no polling timers in the API deployment. F-03's database outcome verification is also complete. F-02 now uses Cloud Tasks, but still requires queue metrics, authenticated platform resources, and failure-injection integration tests. Provision Cloud Run Jobs for the named scheduled passes and the Cloud Tasks route before claiming serverless readiness.

The deployment must prove that terminating the API process does not stop queued payment, refund, withdrawal, delivery, or repair work.

### Step 8 — Configure and load-test database access

Implement the explicit pool configuration from section 4.4. Test cold starts, maximum configured instances, concurrent requests, long-running provider operations, and worker jobs. Confirm the database remains below its connection budget under the intended deployment limits.

### Step 9 — Bound reads and optimize repeated queries

Implement F-12 after response contracts are agreed. Add pagination and maximum limits, then measure representative large datasets. Replace repeated queries only where query-count or latency measurements show the expected improvement.

## 6. Verification gates

The following are release gates, not tautological tests:

- A payment initialization timeout is eventually reconciled to one final payment state.
- A refund process termination does not leave an unobservable `SUBMITTED` refund with no recovery path.
- An expired outbox lease is reclaimed; an active lease is not requeued.
- Duplicate queue delivery does not create duplicate payment, refund, withdrawal, or delivery side effects.
- A suspended agent cannot use an existing or newly created session.
- OTP abuse limits apply across multiple API instances.
- A webhook is acknowledged only after its event is durably recorded.
- Production delivery and SMS failures are retryable, observable, and not silently marked successful.
- Pricing activation events are claimed and applied at their effective time.
- API scale-to-zero does not stop scheduled or queued work.
- Database connections remain within the configured budget during the maximum-instance test.
- Large list endpoints remain bounded and return pagination metadata.

Current repository verification observed during the 2026-09-01 implementation:

- Root and API TypeScript typecheck: passed.
- API build: passed.
- Honest API lint with inline configuration disabled: passed with no findings.
- API unit tests: 29 suites and 105 tests passed.
- Database-backed integration tests: not verified because `TEST_DATABASE_URL` is unavailable; they were not treated as passing without one.

## 7. Provider-neutral deployment recommendation

Keep provider-specific code at the infrastructure boundary:

| Concern        | Application contract                                                 | Example adapters                                                |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Queue          | Publish durable task by outbox ID; acknowledge only after acceptance | Cloud Tasks, Pub/Sub, SQS, Redis, dedicated Postgres worker     |
| Scheduler      | Invoke bounded repair/reconciliation job                             | Cloud Scheduler, EventBridge, Kubernetes CronJob, systemd timer |
| SMS/email      | Submit idempotent delivery and record result                         | Twilio, Africa's Talking, SendGrid, provider-specific gateway   |
| Object storage | Private upload and short-lived signed URL                            | GCS, S3, MinIO                                                  |
| Secrets        | Environment/config interface                                         | Secret Manager, Secrets Manager, Vault, injected environment    |
| Rate limiting  | Shared counter/lease storage                                         | Redis, database, edge/WAF service                               |

The domain services should not import cloud SDKs. Select adapters through validated configuration, but do not instantiate every provider in the same runtime merely to make switching possible.

## 8. Final decision

The current API is **not approved for scale-to-zero serverless** and should not be treated as production-ready merely by setting `minInstance=1`. Keeping one instance alive would reduce missed polling, but it would not fix:

- payment recovery;
- refund recovery;
- unsafe outbox requeue;
- production delivery;
- production SMS;
- suspended-agent access; or
- missing agent OTP limits.

After the remaining F-02 work and F-04 through F-11 are corrected and the verification gates pass, the HTTP layer can be deployed serverlessly with separate queue and scheduled-job execution. Until then, a long-running API plus separately operated workers is the safer interim model, but it still requires the financial and production blockers to be fixed.

# Plan 003: Remove Redis and continuous polling workers

> **Executor instructions**: This is the clean removal part. Plans 001 and
> 002 must be verified before starting. Delete Redis-specific code and the
> continuous worker path; preserve Cloud Run Jobs and the task consumer. There
> is no compatibility mode, dual queue, or data migration required because the
> project is still in early development.

> **Drift check (run first)**: `git diff --stat 3bfad014..HEAD -- apps/api/src apps/api/package.json pnpm-lock.yaml apps/api/.env.example`.
> Confirm the Cloud Tasks publisher and task consumer are present and their
> tests pass. If not, stop rather than deleting the only working dispatch path.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/001-cloud-tasks-publisher.md`, `plans/002-cloud-tasks-consumer.md`
- **Category**: tech-debt
- **Planned at**: commit `3bfad014`, 2026-08-31

## Why this matters

Leaving Redis worker code beside Cloud Tasks creates ambiguous production
configuration and makes it easy to deploy a continuous process that cannot
scale to zero. It also leaves the exact `NOGROUP` failure mode currently seen
in logs. This part leaves one immediate queue implementation, one task
consumer, and bounded scheduled jobs.

## Current state

Redis-specific code and references currently include:

- `apps/api/src/operations/redis-outbox.queue.ts` — Redis Stream client,
  stream/group creation, pending-message claiming, and acknowledgement.
- `apps/api/src/operations/redis-outbox.dispatcher.ts` — continuous/bounded
  Redis publication.
- `apps/api/src/operations/redis-outbox.consumer.ts` — continuous Redis
  consumption and event routing.
- `apps/api/src/operations/outbox-event-types.ts:1-24` — Redis-prefixed event
  exports.
- `apps/api/src/worker-main.ts` — continuous Nest worker entrypoint.
- `apps/api/src/worker-app.module.ts` — registers Redis queue, dispatcher, and
  consumer plus polling worker providers.
- `apps/api/src/worker-runtime.ts:23-35` — `isQueueWorkerEnabled` and
  continuous-worker decisions tied to Redis.
- `apps/api/src/job-main.ts:7-8,36-106` — imports Redis services and runs them
  for `JOB_NAME=outbox`.
- `apps/api/package.json:21,49` — `start:worker` script and Redis runtime
  dependency.
- `apps/api/.env.example:4-11` and `apps/api/src/config/environment.ts` —
  `QUEUE_PROVIDER`, `REDIS_URL`, and `continuous` worker configuration.

The outbox handler classes are not Redis-specific and must remain available to
the task consumer. The reconciliation worker classes and `job-main` remain
needed for bounded Cloud Run Jobs.

## Scope

In scope:

- delete the three Redis queue/dispatcher/consumer source files;
- delete the obsolete continuous `worker-main` entrypoint;
- remove Redis providers from module composition;
- remove Redis package/configuration/scripts and rename Redis-specific event
  constants/types;
- remove `JOB_NAME=outbox` Redis execution from `job-main`;
- retain or simplify shared run-once logic required by Cloud Run Jobs;
- update source tests and `.env.example`.

Out of scope:

- Cloud Tasks publisher/consumer behavior; already completed in Plans 001/002.
- Domain handler semantics, payment/refund/delivery providers, and Agent OTP.
- Cloud IAM, Docker, Cloud Scheduler, or live queue creation; Plan 004.
- Database schema migration. Existing PostgreSQL outbox rows remain canonical.

## Steps

### Step 1: Remove Redis composition and entrypoints

Remove Redis imports/providers from the composition root used by jobs and the
task consumer. Delete `worker-main.ts` and the `start:worker` package script.
Remove any module comments that claim a continuous worker is intentionally
supported.

Do not delete the existing domain handler classes merely because their old
polling workers are deleted; Plan 002's router uses those handlers.

**Verify**: `rg -n "RedisOutbox|REDIS_OUTBOX|redis|start:worker|worker-main"
apps/api/src apps/api/package.json` -> no runtime/source matches except a
temporary test or changelog reference explicitly removed before this step is
complete.

### Step 2: Make `job-main` bounded and Cloud Tasks-aware

Remove the Redis `outbox` job branch and the Redis imports from
`apps/api/src/job-main.ts`. Keep the allowlisted reconciliation and lease
recovery job names. Add an explicit `outbox-repair` run-once job that uses the
Cloud Tasks publisher to find eligible durable outbox events whose task
publication is missing or whose claim lease expired, then republishes them
with the same safe claim/reschedule rules as Plan 001.

If an `all` job remains, define it explicitly as the bounded reconciliation
set and do not make it poll the outbox continuously. Prefer separate scheduled
jobs in deployment so a slow provider reconciliation cannot delay queue repair.

**Verify**: run `node apps/api/dist/job-main.js` only after building, with each
allowlisted name under a test configuration. Invalid names must fail before
work starts; `outbox` must be rejected; `outbox-repair` must invoke Cloud Tasks
publication rather than Redis. Add a focused test around `parseJobName` and
job dispatch selection.

### Step 3: Remove continuous polling behavior

Delete obsolete outbox polling workers that have no remaining caller after the
task consumer exists: `GeneralOutboxWorker`, `PricingOutboxWorker`,
`RefundOutboxWorker`, `WithdrawalOutboxWorker`, and `DeliveryOutboxWorker`.
Keep the handler counterparts.

For payment initialization, refund reconciliation, withdrawal reconciliation,
lease recovery, and invariant reconciliation, retain explicit `runOnce()`
services for `job-main`. Remove `OnModuleInit` timer startup if it exists only
to support the old continuous worker. Make error propagation from a run-once
job explicit and testable instead of depending on a `WORKER_EXECUTION=continuous`
branch.

Reduce `worker-runtime.ts` to only helpers genuinely required by bounded jobs,
or delete it if no imports remain. Do not leave a configuration option that
claims a continuous worker is supported.

**Verify**: boot the task-consumer module in a test and wait longer than one
poll interval; no timer-driven database claim occurs. Build and run each job
once with a test fixture; each exits after one bounded pass.

### Step 4: Remove Redis configuration and dependency

Remove `QUEUE_PROVIDER`, `REDIS_URL`, Redis URL validation, Redis environment
defaults, and the Redis dependency from the manifest/lockfile. Replace the
`.env.example` comments with Cloud Tasks configuration names and the separate
task-consumer target/audience settings. Keep `WORKER_ENABLED=true` only for
Cloud Run Job processes if the final job guard still needs it; do not retain a
`continuous` value.

Do not put actual Google credentials in `.env.example`. Use clearly named
placeholders and Secret Manager instructions for deployed values.

**Verify**:

```sh
rg -n "RedisOutbox|REDIS_OUTBOX|REDIS_URL|QUEUE_PROVIDER|redis|worker-main|start:worker|continuous" apps/api/src apps/api/package.json apps/api/.env.example
rg -n "^\s*(redis|@redis/)" apps/api/package.json pnpm-lock.yaml
```

Both commands must return no production implementation/configuration matches
or direct Redis dependency. Transitive packages in the lockfile that happen to
contain the word `redis` are not a failure if the manifest has no direct Redis
dependency; report them for review rather than deleting unrelated packages.
Then run API typecheck, build, and tests.

## Test plan

- Update environment tests to assert Cloud Tasks configuration rather than
  Redis configuration.
- Update job-main tests to cover every valid bounded job and reject `outbox`.
- Remove tests that only exercised Redis Stream mechanics.
- Keep meaningful outbox state-transition, handler idempotency, and job failure
  tests. Do not replace deleted Redis tests with tests that only assert a file
  was deleted or a mock was called.

## Done criteria

- [ ] No Redis runtime dependency or Redis implementation remains.
- [ ] No continuous worker entrypoint or continuous polling mode remains.
- [ ] `job-main` contains only bounded scheduled work and outbox repair.
- [ ] Cloud Tasks publisher and consumer are the only immediate outbox path.
- [ ] PostgreSQL outbox schema and durable rows are unchanged.
- [ ] Agent OTP remains direct synchronous SMS.
- [ ] API typecheck, build, tests, and root lint/typecheck pass.
- [ ] The final Redis search returns no implementation/configuration matches.

## STOP conditions

Stop and report if:

- deleting a polling worker would remove the only path for payment,
  refund, withdrawal, or delivery processing;
- `job-main` cannot access the Cloud Tasks publisher without importing the
  public API server or a continuous worker;
- a test or local command depends on Redis as a hidden fixture;
- removing `WORKER_EXECUTION=continuous` changes an intended bounded job
  behavior; or
- the repository contains a Redis deployment artifact outside the listed
  paths.

## Maintenance notes

The absence of Redis should remain an invariant. Review future queue changes
against the Cloud Tasks task contract and verify that no timer/poller is added
to the public API or task consumer. Reconciliation and repair are bounded
Cloud Run Jobs, not a hidden worker service.

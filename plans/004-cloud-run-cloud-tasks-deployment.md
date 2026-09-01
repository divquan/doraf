# Plan 004: Package and verify the Cloud Run and Cloud Tasks deployment

> **Executor instructions**: This plan is deployment and black-box verification
> only. Plans 001–003 must be complete. Create the smallest production-shaped
> deployment required by the accepted Google Cloud serverless architecture:
> public API, private task consumer, Cloud Tasks queue, Cloud Run Jobs, and
> Cloud Scheduler. Do not reintroduce Redis or a permanently running worker.

> **Drift check (run first)**: `git status --short` and
> `git diff --stat 3bfad014..HEAD -- apps/api apps/admin apps/agent apps/storefront package.json pnpm-lock.yaml`.
> Preserve unrelated working-tree changes. If the application entrypoints or
> environment names differ from Plans 001–003, stop and reconcile first.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/003-remove-redis-workers.md`
- **Category**: migration
- **Planned at**: commit `3bfad014`, 2026-08-31

## Why this matters

Application code is not serverless-ready until the platform can authenticate
and invoke the right process, retry tasks, run bounded recovery, and expose
only the public API. This part converts the verified entrypoints into an
immutable deployment and proves an outbox event travels through PostgreSQL,
Cloud Tasks, the private Cloud Run consumer, and an idempotent handler.

## Current state

- `apps/api/src/main.ts` is the HTTP API entrypoint and binds to
  `0.0.0.0`/`PORT`.
- Plan 002 adds a separate HTTP task-consumer entrypoint; it must not be
  deployed from `job-main` or `worker-main`.
- `apps/api/src/job-main.ts` is a run-once bounded process with allowlisted job
  names; Plan 003 adds `outbox-repair`.
- There is currently no Dockerfile, Cloud Build file, Terraform/CDK module,
  Cloud Tasks queue, or Cloud Run deployment manifest in the repository.
- `apps/api/.env.example` identifies the application secrets and pooled/direct
  Supabase database URLs; production values must come from Secret Manager,
  never from source control or image build arguments.

## Target topology

- `dashchecker-api`: public Cloud Run service, `node dist/main.js`,
  `WORKER_ENABLED=false`, scale-to-zero, bounded max instances.
- `dashchecker-task-consumer`: private Cloud Run service, task entrypoint,
  scale-to-zero, invokable only by the Cloud Tasks OIDC service account.
- `dashchecker-outbox`: Cloud Tasks queue in the selected region, with bounded
  retry/backoff and a dead-letter policy appropriate for the early pilot.
- Cloud Run Job executions from `node dist/job-main.js` for each allowlisted
  reconciliation/repair name.
- Cloud Scheduler invokes the Cloud Run Jobs using a dedicated scheduler
  service account.
- Supabase PostgreSQL remains the canonical store; API and task consumer use
  the pooled runtime connection and migration commands use the direct URL as
  required by the repository setup.

Agent OTP is not part of this topology: it stays on the API's direct
synchronous SMS sender.

## Scope

In scope:

- root/API container build files needed for reproducible immutable images;
- package scripts or entrypoint commands for API and task consumer;
- Cloud Tasks queue and Cloud Run service configuration;
- service-account/IAM configuration or a precise checked-in deployment script;
- Cloud Run Job and Cloud Scheduler configuration;
- Secret Manager bindings and production env-name documentation;
- deployment smoke tests and operational runbook updates.

Out of scope:

- Redis, Memorystore, Redis secrets, or a worker service.
- Changes to domain logic, database schema, provider adapters, or OTP.
- Introducing Pub/Sub in addition to Cloud Tasks for the same outbox path.
- Live production deployment without the operator's explicit project, region,
  and credential authorization.

## Steps

### Step 1: Create reproducible container images

Add a Dockerfile/build definition that can install the pnpm workspace with a
frozen lockfile, generate Prisma client, build `@dashchecker/api`, and retain
the compiled API, task-consumer, and job entrypoints in one immutable image.
Use a non-root runtime where compatible, do not copy `.env` files, and do not
pass secrets as build arguments. Use a pinned Node major compatible with the
repository engine and record the image digest after publication.

Define explicit commands for:

- public API: `node dist/main.js`;
- task consumer: the Plan 002 task HTTP entrypoint;
- Cloud Run Job: `node dist/job-main.js` plus one `JOB_NAME`.

**Verify**: build the image locally or with Cloud Build, start each command in
a test environment, and confirm API/task health endpoints answer on the
injected `PORT`; confirm the job exits nonzero for an invalid job name and
zero for an empty successful bounded pass.

### Step 2: Provision Cloud Tasks and service identities

Create or define:

- one queue with the selected region;
- max attempts, minimum/maximum backoff, max concurrent dispatches, and dead
  letter behavior;
- an API runtime service account allowed to create tasks on that queue;
- a task-invoker service account used in the task OIDC token;
- Cloud Run Invoker permission on the private task-consumer service for the
  task-invoker account;
- the required Service Account User/token-creation permission for the Google
  Cloud Tasks service agent according to the platform's current IAM model;
- a separate scheduler/job execution service account.

Use least privilege and explicitly verify the task OIDC audience equals the
consumer URL configured in the application. Do not make the task consumer
public to avoid IAM workarounds.

**Verify**: inspect IAM policy bindings, enqueue a harmless staging task, and
confirm an unauthenticated request to the task service is rejected while the
Cloud Tasks delivery succeeds with a valid OIDC token.

### Step 3: Deploy API and task consumer

Deploy the API with `WORKER_ENABLED=false` and no Redis variables. Deploy the
task consumer with the Cloud Tasks target/audience and the expected service
account configuration. Inject all credentials from Secret Manager, including
database, Paystack, application key material, and provider credentials. Set
maximum instances and concurrency deliberately so database connection demand
stays below the Supabase pooler limit.

Configure health/readiness behavior and request timeouts. Do not send public
traffic to the task route and do not deploy a `worker-main` service.

**Verify**: `gcloud run services describe` (or equivalent deployment tool)
shows the expected image digest, ingress/authentication, max instances,
service account, and secret bindings. API health succeeds; task service is not
public; no Redis connection attempts appear in logs.

### Step 4: Deploy bounded Jobs and Scheduler

Create separate Cloud Run Jobs for:

- `outbox-repair`;
- `payment-initialization`;
- `payment-reconciliation`;
- `refund-reconciliation`;
- `withdrawal-reconciliation`;
- `lease-recovery`; and
- `invariant-audit`.

Each job must set `WORKER_ENABLED=true`, `WORKER_EXECUTION=run-once` only if
the final code still validates it, one allowlisted `JOB_NAME`, production
configuration, and Secret Manager bindings. Use Cloud Scheduler to trigger
each job with a dedicated identity. Set bounded timeout, retry, concurrency,
and alerting policies. Do not use one perpetual scheduler loop as a substitute
for Cloud Tasks.

**Verify**: trigger each Job manually in staging, capture a successful exit,
and inspect logs for one bounded pass and a clear run outcome. Force one
controlled failure and confirm the Job/Scheduler reports failure and retries;
it must not be recorded as a successful empty pass.

### Step 5: Run an end-to-end task and recovery test

Against a disposable or no-stakes staging database:

1. Cause a real domain transition that writes a safe outbox event.
2. Confirm the publisher creates a Cloud Task with only the minimal payload.
3. Confirm the event reaches `QUEUED`, then the private task consumer invokes
   the existing handler and the event reaches its durable terminal state.
4. Submit the same task twice or force a Cloud Tasks retry and verify there is
   one business effect and one terminal outbox result.
5. Stop or deny the consumer once, confirm Cloud Tasks retries, then restore
   the service and confirm recovery.
6. Create a committed event with publication unavailable, run `outbox-repair`,
   and verify it is published without a duplicate business effect.

Use a non-financial fixture for the first smoke test, then run the existing
payment/refund/withdrawal/delivery integration suites in a provider-safe
environment. Do not use a test that only invokes the publisher and consumer
in the same process; the point is to test platform authentication, queue
delivery, process restart, and PostgreSQL durability together.

**Verify**: record Cloud Tasks attempt history, Cloud Run request logs,
PostgreSQL outbox state transitions, and the handler's durable effect. The
evidence must show retry and duplicate behavior, not just HTTP 200.

### Step 6: Update deployment documentation and remove stale instructions

Update the deployment TODO and architecture/runbook material to say:

- Cloud Tasks is the immediate outbox queue;
- the task consumer is a private scale-to-zero Cloud Run service;
- `job-main` is bounded scheduled execution only;
- no Redis worker or continuous worker is deployed;
- OTP delivery remains direct synchronous SMS and is not an outbox task; and
- production evidence must include image digest, queue, service accounts,
  job schedules, max instances, database connection limits, and owners.

Do not claim delivery is `DELIVERED` merely because Cloud Tasks accepted a
task; provider submission and later provider status remain separate states.

**Verify**: search deployment docs for Redis/continuous-worker instructions
and update/remove stale claims. Confirm every command in the runbook matches
the deployed entrypoint and environment names.

## Test plan

- Container smoke tests for all three entrypoint modes.
- Cloud Tasks black-box staging test with real OIDC/IAM.
- Retry and duplicate delivery test across separate Cloud Run requests.
- Outbox publication-gap repair test using a committed event and an actual
  scheduled job invocation.
- Existing API typecheck, build, lint, unit, and relevant database tests.
- No tautological tests that assert only mocks were called or files exist.

## Done criteria

- [ ] Public API, private task consumer, and bounded Jobs run from immutable
      image digest(s).
- [ ] Cloud Tasks can invoke only the private consumer with the expected OIDC
      identity and audience.
- [ ] Cloud Tasks retries a failed consumer and duplicate delivery remains
      idempotent.
- [ ] Outbox publication gaps are repaired by a bounded Job.
- [ ] Scheduler-triggered Jobs complete and alert on failure.
- [ ] API has no worker/Redis configuration and scales to zero.
- [ ] No continuous worker service exists.
- [ ] Staging evidence includes queue attempts, Cloud Run logs, and PostgreSQL
      state/effect verification.
- [ ] No OTP delivery was moved to Cloud Tasks.

## STOP conditions

Stop and report if:

- the task consumer must be public for Cloud Tasks to reach it;
- the Cloud Tasks OIDC audience or service-account principal cannot be pinned;
- the task consumer needs a minimum instance to avoid losing correctness;
- database connection demand exceeds the Supabase pooler limits;
- a retry/duplicate produces a second financial, inventory, or delivery
  effect; or
- the selected Google Cloud project/region/credentials are not provided by
  the operator.

## Maintenance notes

The deployment has two independent reliability mechanisms: Cloud Tasks gives
fast at-least-once invocation, while PostgreSQL outbox and scheduled repair
protect against publication gaps. Future changes must preserve both. Review
any new task route for IAM scope, body minimization, retry status semantics,
and database connection impact.

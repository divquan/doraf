# Deployment TODO

Status: Open — packaging complete, live deployment blocked (see § Blocked)
Last updated: 2026-09-01

Cloud Tasks is the immediate outbox queue. The task consumer is a private
scale-to-zero Cloud Run service. `job-main` is bounded scheduled execution
only. No Redis worker or continuous worker is deployed. OTP delivery remains
direct synchronous SMS and is not an outbox task.

This list records work after the F-01/F-02 application changes and Plan 004
packaging. One immutable image (`Dockerfile`, `cloudbuild.yaml`) contains
`dist/main.js`, `dist/task-main.js`, and `dist/job-main.js`. See
`deploy/README.md` and `deploy/gcloud/*` for the precise checked-in gcloud
commands, queue retry/rate policy, service-account IAM (least privilege, OIDC
audience pinned), Secret Manager bindings, and pilot evidence requirements.
Do not claim delivery is `DELIVERED` merely because Cloud Tasks accepted a
task; provider submission and later provider status remain separate states.

## F-01 — Scheduled execution

- [x] Packaging: `Dockerfile` (pinned Node 20, non-root, no `.env`/build-arg secrets, frozen lockfile, `db:generate` + `build`) and `cloudbuild.yaml` build all three entrypoints (`dist/main.js`, `dist/task-main.js`, `dist/job-main.js`); local build verified (`pnpm --filter @dashchecker/api build`, `node --check`).
- [x] Commands defined in `apps/api/package.json`: `node dist/main.js` (public API, `WORKER_ENABLED=false`), `node dist/task-main.js` (task consumer), `node dist/job-main.js <JOB_NAME>` (bounded jobs, `WORKER_ENABLED=true` `WORKER_EXECUTION=run-once`).
- [x] `src/job-main.ts` allowlist now includes `outbox-repair`, `lease-recovery`, `invariant-audit` plus existing reconciliation jobs; `src/task-main.ts` + `TaskConsumerModule` expose private `POST /internal/tasks/outbox` with OIDC audience/principal verification and minimal `{eventId, claimToken, eventType}` body.
- [ ] Select the Google Cloud project, region, service accounts, Artifact Registry repository, and Cloud Run maximum-instance limits.
- [ ] Publish the immutable image and record its digest (`deploy/README.md` `docker inspect` / `gcloud artifacts docker images describe`).
- [ ] Create Cloud Run Jobs using the deployment scripts (`deploy/gcloud/05-jobs.sh`, `node dist/job-main`) – one job per `JOB_NAME`.
- [ ] Configure each scheduled job with: `NODE_ENV=production`, `WORKER_ENABLED=true`, `WORKER_EXECUTION=run-once`, one allowlisted `JOB_NAME`.
- [ ] Inject production secrets through Secret Manager (Supabase pooled `DATABASE_URL` and direct migration `DIRECT_URL` are separate, plus `DASHCHECKER_CRYPTO_KEYS_JSON` and `PAYSTACK_SECRET_KEY`); inject runtime configurations (`PAYSTACK_MODE=live`, `PAYSTACK_GUEST_EMAIL_DOMAIN`, `INTERNAL_AUTH_*`) as environment variables.
- [ ] Create Cloud Scheduler triggers for the bounded jobs (`deploy/gcloud/06-schedulers.sh`): `outbox-repair`, `payment-initialization`, `payment-reconciliation`, `refund-reconciliation`, `withdrawal-reconciliation`, `lease-recovery`, `invariant-audit`.
- [ ] Protect each Cloud Run Job execution with the dedicated scheduler service account and per-job Cloud IAM (`roles/run.invoker`). Cloud Scheduler calls the regional Cloud Run Jobs Admin API with OAuth; do not expose the job command as a public HTTP mutation endpoint.
- [ ] Set timeout (`--task-timeout=300`), retry (`--max-retries=3`), failure-notification policies for each job. A failed job must be retried and alerted, not treated as a successful empty pass.
- [ ] Run a production-like test that terminates the API process after a transaction and verifies the scheduled job completes the durable work.

## Immediate outbox execution — Cloud Tasks (packaged, not yet provisioned live)

Packaged in `deploy/gcloud/02-queue.sh`, `04-deploy-task-consumer.sh`, `03-deploy-api.sh`, and `deploy/README.md`:

- Queue `dashchecker-outbox` with bounded retry/backoff/rate (`maxAttempts=10`, `minBackoff=10s`/`maxBackoff=600s`/`maxDoublings=4`, `maxConcurrentDispatches=50`, `maxDispatchesPerSecond=100`; pilot dead-letter posture).
- API service account (`dashchecker-api`) and Scheduler SA (`dashchecker-scheduler`) have `roles/cloudtasks.enqueuer` on the queue only.
- Task-invoker SA (`dashchecker-task-invoker`) is the OIDC principal; `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL` and `CLOUD_TASKS_AUDIENCE` are pinned to the private consumer URL (`https://dashchecker-task-consumer-.../internal/tasks/outbox`).
- Cloud Tasks service agent has `roles/iam.serviceAccountTokenCreator` on the task-invoker SA (required for OIDC).
- Task consumer is `ingress=internal`, `allow-unauthenticated=false`, `roles/run.invoker` only for the task-invoker SA.
- API remains `WORKER_ENABLED=false`, scale-to-zero, `maxInstances=10` `concurrency=80` (example bound for Supabase pooler; validate under load).

Verification gates before claiming readiness (Plan 004 Step 5, disposable/staging DB):

1. Domain transition writes safe outbox event; publisher creates Cloud Task with only `{eventId, claimToken, eventType}`.
2. Event → `QUEUED` → authenticated private consumer → terminal state (`DISPATCHED` / terminal `FAILED`).
3. Duplicate task / forced retry → one business effect, one terminal outbox result.
4. Deny consumer once → Cloud Tasks retries → restore → recovery observed.
5. Publish gap → `outbox-repair` job republishes without duplicate effect. Record queue attempts, Cloud Run logs, PostgreSQL transitions.

Remaining live-provisioning steps (blocked until project/region/credentials authorized):

- [ ] Provision the Cloud Tasks queue live with the above policy (blocked: no project/region/credentials supplied).
- [ ] Deploy the private task consumer and public API from the recorded digest (blocked).
- [ ] Verify unauthenticated `POST /internal/tasks/outbox` is `401/403` and OIDC delivery succeeds (blocked).
- [ ] Configure a real production SMS/email gateway before enabling delivery events in production; missing configuration must remain observable and must not use the development adapter.

## Release evidence (pilot)

- [ ] Capture successful Cloud Run Job executions and failure/retry logs (requires live Jobs).
- [x] Confirm the API services have `WORKER_ENABLED=false` (packaged in `deploy/gcloud/03-deploy-api.sh` + `Dockerfile` docs; live confirmation blocked).
- [x] Confirm no continuously running worker is required (code: `WorkerAppModule` only has bounded workers; `start:worker` and `continuous` removed; Redis deleted; `rg` zero matches verified in Plans 001-003).
- [ ] Record the deployed image digest, Cloud Tasks queue attempt history, Cloud Run request logs, PostgreSQL outbox state transitions, handler durable effects, schedules, service accounts, database connection limits (Supabase pooler), and owners in the launch runbook.

## Blocked — live Google Cloud deployment

No project, region, Artifact Registry, or credentials were supplied and no
explicit authorization to mutate live resources was given. All `deploy/gcloud/*`
scripts are checked-in, locally shell-checked, but not executed against a
project. The artifacts are locally verified (`typecheck`, `build`, unit tests
pass – see implementation-progress.md). Proceeding to `gcloud` provisioning
requires `PROJECT_ID`, `REGION`, `REPOSITORY`, `IMAGE_URI` (with digest), and
operator confirmation.

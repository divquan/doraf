# Dashchecker deployment packaging (Plan 004)

This directory contains the smallest production-shaped deployment for the
accepted serverless topology. It is **packaging/configuration only** – no live
Google Cloud resources are created without the operator supplying explicit
project, region, credentials, and authorization (see Blocker below).

## Topology

- `dashchecker-api` – public Cloud Run service, `node dist/main.js`,
  `WORKER_ENABLED=false`, scale-to-zero, `maxInstances` bounded for the
  Supabase pooler.
- `dashchecker-task-consumer` – private Cloud Run service,
  `node dist/task-main.js`, same image, `ingress=internal`, `allow-unauthenticated=false`,
  invokable only by the Cloud Tasks OIDC service account.
- `dashchecker-outbox` – Cloud Tasks queue in the selected region, bounded
  retry/backoff, rate limits, and pilot dead-letter posture.
- Cloud Run Jobs – `node dist/job-main.js` with one allowlisted `JOB_NAME`
  (`outbox-repair`, `payment-initialization`, `payment-reconciliation`,
  `refund-reconciliation`, `withdrawal-reconciliation`, `lease-recovery`,
  `invariant-audit`). Each job is `WORKER_ENABLED=true` `WORKER_EXECUTION=run-once`.
- Cloud Scheduler – dedicated scheduler service account triggers each Job.
- Supabase PostgreSQL remains canonical; API and task consumer use the pooled
  `DATABASE_URL`, migrations use `DIRECT_URL`.

Agent OTP stays on the API's direct synchronous SMS sender – it is never routed
through Cloud Tasks (see ADR and serverless-readiness-report.md F-08).

## Image

One immutable image contains all three entrypoints:

```
node dist/main.js        # public API
node dist/task-main.js   # private task consumer
node dist/job-main.js    # bounded job (requires JOB_NAME)
```

Build locally (no secrets baked):

```sh
docker build -t dashchecker-api:local -f Dockerfile .
# Record digest:
docker inspect --format='{{index .RepoDigests 0}}' dashchecker-api:local
# Or via Artifact Registry after `docker push`:
gcloud artifacts docker images describe REGION-docker.pkg.dev/PROJECT/REPO/dashchecker-api:TAG --format='value(image_summary.digest)'
```

Or via Cloud Build (see `../cloudbuild.yaml`):

```sh
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_PROJECT_ID=PROJECT,_REGION=us-central1,_REPOSITORY=dashchecker
```

Verify entrypoints without live credentials (see Plan 004 Step 1):

```sh
# Invalid job must exit non-zero before work starts
docker run --rm -e WORKER_ENABLED=true -e WORKER_EXECUTION=run-once dashchecker-api:local node dist/job-main.js invalid
# Health wiring is present in both HTTP services (requires DATABASE_URL at runtime)
# Provide crypto keys as a single JSON secret (nine distinct 32-byte base64 values):
#   DASHCHECKER_CRYPTO_KEYS_JSON='{"VOUCHER_MASTER_KEY_BASE64":"...","VOUCHER_FINGERPRINT_KEY_BASE64":"...","SESSION_FINGERPRINT_KEY_BASE64":"...","INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64":"...","AGENT_PHONE_ENCRYPTION_KEY_BASE64":"...","AGENT_PHONE_FINGERPRINT_KEY_BASE64":"...","OTP_FINGERPRINT_KEY_BASE64":"...","ORDER_CONTACT_ENCRYPTION_KEY_BASE64":"...","ORDER_CONTACT_FINGERPRINT_KEY_BASE64":"..."}'
docker run --rm -e PORT=3000 -e DATABASE_URL=postgresql://user:pass@host/db -e DASHCHECKER_CRYPTO_KEYS_JSON='{"VOUCHER_MASTER_KEY_BASE64":"...","VOUCHER_FINGERPRINT_KEY_BASE64":"...","SESSION_FINGERPRINT_KEY_BASE64":"...","INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64":"...","AGENT_PHONE_ENCRYPTION_KEY_BASE64":"...","AGENT_PHONE_FINGERPRINT_KEY_BASE64":"...","OTP_FINGERPRINT_KEY_BASE64":"...","ORDER_CONTACT_ENCRYPTION_KEY_BASE64":"...","ORDER_CONTACT_FINGERPRINT_KEY_BASE64":"..."}' dashchecker-api:local node dist/main.js
curl -f http://localhost:3000/health/live
```

## Configuration

Production secrets are injected via Secret Manager, never via `.env` files or
`--build-arg`. Required names (validated in `apps/api/src/config/environment.ts`):

`DATABASE_URL`, `DIRECT_URL`, `DASHCHECKER_CRYPTO_KEYS_JSON` (single JSON Secret Manager value containing nine distinct 32-byte base64 keys: `VOUCHER_MASTER_KEY_BASE64`, `VOUCHER_FINGERPRINT_KEY_BASE64`, `SESSION_FINGERPRINT_KEY_BASE64`, `INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64`, `AGENT_PHONE_ENCRYPTION_KEY_BASE64`, `AGENT_PHONE_FINGERPRINT_KEY_BASE64`, `OTP_FINGERPRINT_KEY_BASE64`, `ORDER_CONTACT_ENCRYPTION_KEY_BASE64`, `ORDER_CONTACT_FINGERPRINT_KEY_BASE64` — each independently generated via `openssl rand -base64 32`, no reuse), `PAYSTACK_SECRET_KEY`, `INTERNAL_AUTH_*`, `CLOUD_TASKS_*`.

For Cloud Tasks the live values must satisfy:

```
CLOUD_TASKS_TARGET_URL == CLOUD_TASKS_AUDIENCE == https://dashchecker-task-consumer-XXXX-uc.a.run.app/internal/tasks/outbox
CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL == dashchecker-task-invoker@PROJECT.iam.gserviceaccount.com
```

Do not put Google credentials in `.env.example`.

## Deploy order

All scripts under `gcloud/` are idempotent and require explicit env vars.
Do not run them without the operator's project/region/authorization.

1. `gcloud/00-prerequisites.sh` – enable APIs, create Artifact Registry.
2. `gcloud/01-service-accounts.sh` – create API, task-invoker, scheduler SAs and IAM least-privilege bindings.
3. `gcloud/02-queue.sh` – create `dashchecker-outbox` queue with retry/rate policy.
4. `gcloud/03-deploy-api.sh` – deploy public API (`WORKER_ENABLED=false`).
5. `gcloud/04-deploy-task-consumer.sh` – deploy private task consumer.
6. `gcloud/05-jobs.sh` – create/update 7 Cloud Run Jobs.
7. `gcloud/06-schedulers.sh` – create Cloud Scheduler triggers for each Job.

Each script prints the `gcloud` command it will run and exits 1 if required
env vars are absent. Provide `PROJECT_ID`, `REGION`, `IMAGE_URI` (with digest),
and `TASK_CONSUMER_URL` as documented inside the scripts.

## Verification gates (Plan 004 Step 5)

Against a disposable/staging database, after `gcloud` deployment:

1. Cause a domain transition that writes a safe outbox event (e.g., pricing activation).
2. Confirm publisher created a Cloud Task with only `{eventId, claimToken, eventType}`.
3. Confirm event → `QUEUED` → private consumer → terminal state (`DISPATCHED` or `FAILED` terminal).
4. Submit same task twice / force retry – one business effect, one terminal outbox result.
5. Deny consumer once, confirm Cloud Tasks retries, restore – recovery observed.
6. Create committed event with publication unavailable, run `outbox-repair` job, verify republish without duplicate effect.

Evidence to record: Cloud Tasks attempt history, Cloud Run request logs,
PostgreSQL outbox transitions, handler durable effect. A handler's `200` alone
is not success proof.

## Blocker

Live deployment is **blocked** until the operator provides:

- Google Cloud project ID
- Region (default `us-central1`)
- Artifact Registry repository
- Credentials / `gcloud auth` principal with Cloud Run Admin, Cloud Tasks Admin,
  IAM Admin, Secret Manager Admin
- Explicit authorization to create queues, services, jobs, and schedulers

Without these, this PR contains only the locally verified artifacts:
Dockerfile, cloudbuild.yaml, gcloud scripts, and documentation updates.
See `../docs/planning/deployment-todo.md` for the remaining operational checklist.

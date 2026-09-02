#!/usr/bin/env bash
set -euo pipefail

# 05-jobs.sh – create/update Cloud Run Jobs for bounded reconciliation/repair.
# Reads: env.production (override with DEPLOY_ENV_FILE)
# Each job is WORKER_ENABLED=true WORKER_EXECUTION=run-once + one JOB_NAME.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${IMAGE_URI:?IMAGE_URI is required (e.g., us-central1-docker.pkg.dev/PROJECT/REPO/dashchecker-api:SHA@sha256:...)}"
REGION="${REGION:-us-central1}"
NODE_ENV="${NODE_ENV:-production}"
QUEUE="${QUEUE:-dashchecker-outbox}"
SERVICE_ACCOUNT="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. Validate immutable digest in IMAGE_URI
if [[ ! "${IMAGE_URI}" =~ @sha256:[a-fA-F0-9]{64}$ ]]; then
  echo "ERROR: IMAGE_URI must include an immutable sha256 digest (e.g., ...:tag@sha256:64hex)" >&2
  exit 1
fi
if [[ "${NODE_ENV}" != "production" && "${NODE_ENV}" != "development" ]]; then
  echo "ERROR: NODE_ENV must be production or development (got: ${NODE_ENV})" >&2
  exit 1
fi

# 2. Require an environment/mode pair that matches the application config.
: "${PAYSTACK_MODE:?PAYSTACK_MODE is required (live for production, sandbox for staging)}"
if [[ "${NODE_ENV}" == "production" && "${PAYSTACK_MODE}" != "live" ]]; then
  echo "ERROR: NODE_ENV=production requires PAYSTACK_MODE=live (got: ${PAYSTACK_MODE})" >&2
  exit 1
fi
if [[ "${NODE_ENV}" != "production" && "${PAYSTACK_MODE}" != "sandbox" ]]; then
  echo "ERROR: NODE_ENV=${NODE_ENV} requires PAYSTACK_MODE=sandbox (got: ${PAYSTACK_MODE})" >&2
  exit 1
fi
: "${PAYSTACK_GUEST_EMAIL_DOMAIN:?PAYSTACK_GUEST_EMAIL_DOMAIN is required (e.g., example.com)}"
: "${INTERNAL_AUTH_RP_NAME:?INTERNAL_AUTH_RP_NAME is required (e.g., 'Dashchecker Administration')}"
: "${INTERNAL_AUTH_RP_ID:?INTERNAL_AUTH_RP_ID is required (e.g., admin.dashchecker.com)}"
: "${INTERNAL_AUTH_ORIGIN:?INTERNAL_AUTH_ORIGIN is required (e.g., https://admin.dashchecker.com)}"

# 3. Derive or require TASK_CONSUMER_URL without broken REPLACE_ME fallback
TASK_CONSUMER_URL="${TASK_CONSUMER_URL:-}"
if [[ -z "${TASK_CONSUMER_URL}" ]]; then
  if TASK_CONSUMER_URL="$(gcloud run services describe dashchecker-task-consumer --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)' 2>/dev/null)"; then
    echo "==> Derived TASK_CONSUMER_URL=${TASK_CONSUMER_URL} from Cloud Run"
  else
    echo "ERROR: dashchecker-task-consumer is not yet deployed and TASK_CONSUMER_URL was not set." >&2
    echo "Deploy dashchecker-task-consumer first (04-deploy-task-consumer.sh) or provide TASK_CONSUMER_URL explicitly." >&2
    exit 1
  fi
fi

TASK_CONSUMER_URL="${TASK_CONSUMER_URL%/}"
if [[ "${TASK_CONSUMER_URL}" != https://* ]]; then
  echo "ERROR: TASK_CONSUMER_URL must be an https:// URL (got: ${TASK_CONSUMER_URL})" >&2
  exit 1
fi

CLOUD_TASKS_TARGET_URL="${TASK_CONSUMER_URL}/internal/tasks/outbox"
CLOUD_TASKS_AUDIENCE="${TASK_CONSUMER_URL}/internal/tasks/outbox"
CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL="dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Ensuring Secret Manager access for ${SERVICE_ACCOUNT}"
SECRETS="DATABASE_URL=DATABASE_URL:latest,DASHCHECKER_CRYPTO_KEYS_JSON=DASHCHECKER_CRYPTO_KEYS_JSON:latest,PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest"
for secret in DATABASE_URL DASHCHECKER_CRYPTO_KEYS_JSON PAYSTACK_SECRET_KEY; do
  gcloud secrets add-iam-policy-binding "${secret}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done
for secret in HUBTEL_CLIENT_ID HUBTEL_CLIENT_SECRET HUBTEL_SENDER_ID LOOPS_API_KEY LOOPS_VOUCHER_TRANSACTIONAL_ID; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Granting ${secret} to ${SERVICE_ACCOUNT}"
    gcloud secrets add-iam-policy-binding "${secret}" \
      --project="${PROJECT_ID}" \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" >/dev/null
    SECRETS="${SECRETS},${secret}=${secret}:latest"
  fi
done

JOBS=(
  "outbox-repair"
  "payment-initialization"
  "payment-reconciliation"
  "refund-reconciliation"
  "withdrawal-reconciliation"
  "lease-recovery"
  "invariant-audit"
)

for JOB in "${JOBS[@]}"; do
  echo "==> Creating/updating Cloud Run Job dashchecker-${JOB}"
  if gcloud run jobs describe "dashchecker-${JOB}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud run jobs update "dashchecker-${JOB}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --image="${IMAGE_URI}" \
      --command="node" --args="dist/job-main.js,${JOB}" \
      --service-account="${SERVICE_ACCOUNT}" \
      --update-env-vars="^||^NODE_ENV=${NODE_ENV}||WORKER_ENABLED=true||WORKER_EXECUTION=run-once||JOB_NAME=${JOB}||PAYSTACK_MODE=${PAYSTACK_MODE}||PAYSTACK_GUEST_EMAIL_DOMAIN=${PAYSTACK_GUEST_EMAIL_DOMAIN}||INTERNAL_AUTH_RP_NAME=${INTERNAL_AUTH_RP_NAME}||INTERNAL_AUTH_RP_ID=${INTERNAL_AUTH_RP_ID}||INTERNAL_AUTH_ORIGIN=${INTERNAL_AUTH_ORIGIN}||CLOUD_TASKS_PROJECT_ID=${PROJECT_ID}||CLOUD_TASKS_LOCATION=${REGION}||CLOUD_TASKS_QUEUE=${QUEUE}||CLOUD_TASKS_TARGET_URL=${CLOUD_TASKS_TARGET_URL}||CLOUD_TASKS_AUDIENCE=${CLOUD_TASKS_AUDIENCE}||CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL}" \
      --update-secrets="${SECRETS}" \
      --memory=512Mi --cpu=1 --task-timeout=300 --max-retries=3
  else
    gcloud run jobs create "dashchecker-${JOB}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --image="${IMAGE_URI}" \
      --command="node" --args="dist/job-main.js,${JOB}" \
      --service-account="${SERVICE_ACCOUNT}" \
      --set-env-vars="^||^NODE_ENV=${NODE_ENV}||WORKER_ENABLED=true||WORKER_EXECUTION=run-once||JOB_NAME=${JOB}||PAYSTACK_MODE=${PAYSTACK_MODE}||PAYSTACK_GUEST_EMAIL_DOMAIN=${PAYSTACK_GUEST_EMAIL_DOMAIN}||INTERNAL_AUTH_RP_NAME=${INTERNAL_AUTH_RP_NAME}||INTERNAL_AUTH_RP_ID=${INTERNAL_AUTH_RP_ID}||INTERNAL_AUTH_ORIGIN=${INTERNAL_AUTH_ORIGIN}||CLOUD_TASKS_PROJECT_ID=${PROJECT_ID}||CLOUD_TASKS_LOCATION=${REGION}||CLOUD_TASKS_QUEUE=${QUEUE}||CLOUD_TASKS_TARGET_URL=${CLOUD_TASKS_TARGET_URL}||CLOUD_TASKS_AUDIENCE=${CLOUD_TASKS_AUDIENCE}||CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL}" \
      --set-secrets="${SECRETS}" \
      --memory=512Mi --cpu=1 --task-timeout=300 --max-retries=3
  fi

  echo "==> Granting Scheduler SA Cloud Run Invoker on dashchecker-${JOB}"
  gcloud run jobs add-iam-policy-binding "dashchecker-${JOB}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.invoker" >/dev/null
done

echo "==> All jobs configured. Trigger manually to verify bounded pass:"
echo "    gcloud run jobs execute dashchecker-outbox-repair --region=${REGION} --project=${PROJECT_ID} --wait"
echo "    gcloud run jobs execute dashchecker-lease-recovery --region=${REGION} --project=${PROJECT_ID} --wait"

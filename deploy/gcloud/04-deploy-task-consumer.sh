#!/usr/bin/env bash
set -euo pipefail

# 04-deploy-task-consumer.sh – deploy private task-consumer Cloud Run service.
# Reads: env.production (override with DEPLOY_ENV_FILE)
# Private (ingress=internal, no allow-unauthenticated), scales to zero,
# invokable ONLY by dashchecker-task-invoker OIDC.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${IMAGE_URI:?IMAGE_URI is required (e.g., us-central1-docker.pkg.dev/PROJECT/REPO/dashchecker-api:SHA@sha256:...)}"
REGION="${REGION:-us-central1}"
NODE_ENV="${NODE_ENV:-production}"
SERVICE="dashchecker-task-consumer"
QUEUE="${QUEUE:-dashchecker-outbox}"
SERVICE_ACCOUNT="dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

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

echo "==> Deploying private service ${SERVICE} from ${IMAGE_URI}"

# Initial bootstrap deployment uses https://localhost/internal/tasks/outbox to satisfy validateEnvironment()
# before the canonical Cloud Run URL is assigned; the target/audience are pinned immediately below.
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --ingress=internal \
  --no-allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}" \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=0 \
  --timeout=30 \
  --cpu-throttling \
  --set-env-vars="^||^NODE_ENV=${NODE_ENV}||WORKER_ENABLED=false||WORKER_EXECUTION=run-once||PAYSTACK_MODE=${PAYSTACK_MODE}||PAYSTACK_GUEST_EMAIL_DOMAIN=${PAYSTACK_GUEST_EMAIL_DOMAIN}||INTERNAL_AUTH_RP_NAME=${INTERNAL_AUTH_RP_NAME}||INTERNAL_AUTH_RP_ID=${INTERNAL_AUTH_RP_ID}||INTERNAL_AUTH_ORIGIN=${INTERNAL_AUTH_ORIGIN}||CLOUD_TASKS_PROJECT_ID=${PROJECT_ID}||CLOUD_TASKS_LOCATION=${REGION}||CLOUD_TASKS_QUEUE=${QUEUE}||CLOUD_TASKS_TARGET_URL=https://localhost/internal/tasks/outbox||CLOUD_TASKS_AUDIENCE=https://localhost/internal/tasks/outbox||CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT}" \
  --set-secrets="${SECRETS}" \
  --command="node" \
  --args="dist/task-main.js"

# Capture deployed service URL and update target/audience
TASK_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"
TASK_URL="${TASK_URL%/}"
if [[ "${TASK_URL}" != https://* ]]; then
  echo "ERROR: Derived TASK_URL must be an https:// URL (got: ${TASK_URL})" >&2
  exit 1
fi
echo "==> Task consumer URL: ${TASK_URL}"

echo "==> Pinning CLOUD_TASKS_TARGET_URL and AUDIENCE on ${SERVICE}"
gcloud run services update "${SERVICE}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="CLOUD_TASKS_TARGET_URL=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_AUDIENCE=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT}"

if gcloud run services describe "dashchecker-api" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Updating existing dashchecker-api with task consumer target and audience"
  gcloud run services update "dashchecker-api" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --update-env-vars="CLOUD_TASKS_TARGET_URL=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_AUDIENCE=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT}"
else
  echo "==> dashchecker-api not yet deployed; it will discover TASK_CONSUMER_URL on deploy (03-deploy-api.sh)"
fi

echo "==> Grant Cloud Run Invoker on task consumer to the task-invoker SA"
gcloud run services add-iam-policy-binding "${SERVICE}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" >/dev/null

echo "==> Verify private ingress and OIDC:"
echo "    curl -f ${TASK_URL}/health/live  # should 403 without token"
echo "    gcloud run services describe ${SERVICE} --region=${REGION} --project=${PROJECT_ID} | grep -E 'ingress|serviceAccountName'"
echo "    gcloud run services get-iam-policy ${SERVICE} --region=${REGION} --project=${PROJECT_ID}"

#!/usr/bin/env bash
set -euo pipefail

# 05-jobs.sh – create/update Cloud Run Jobs for bounded reconciliation/repair.
# Requires: PROJECT_ID, REGION, IMAGE_URI (with digest)
# Each job is WORKER_ENABLED=true WORKER_EXECUTION=run-once + one JOB_NAME.

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${IMAGE_URI:?IMAGE_URI is required}"
REGION="${REGION:-us-central1}"
# TASK_CONSUMER_URL may be supplied explicitly; otherwise derive from the deployed task-consumer service.
TASK_CONSUMER_URL="${TASK_CONSUMER_URL:-}"
if [[ -z "${TASK_CONSUMER_URL}" ]]; then
  if TASK_CONSUMER_URL="$(gcloud run services describe dashchecker-task-consumer --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)' 2>/dev/null)"; then
    echo "==> Derived TASK_CONSUMER_URL=${TASK_CONSUMER_URL} from Cloud Run"
  else
    echo "==> WARNING: dashchecker-task-consumer not yet deployed; using placeholder TARGET_URL/AUDIENCE"
    echo "    Re-run this script after 04-deploy-task-consumer.sh or set TASK_CONSUMER_URL=https://dashchecker-task-consumer-XXXX-uc.a.run.app"
    TASK_CONSUMER_URL="https://dashchecker-task-consumer-REPLACE_ME.a.run.app"
  fi
fi
CLOUD_TASKS_TARGET_URL="${TASK_CONSUMER_URL}/internal/tasks/outbox"
CLOUD_TASKS_AUDIENCE="${TASK_CONSUMER_URL}/internal/tasks/outbox"
CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL="dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

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
      --service-account="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --set-env-vars="NODE_ENV=production,WORKER_ENABLED=true,WORKER_EXECUTION=run-once,JOB_NAME=${JOB}" \
      --set-env-vars="CLOUD_TASKS_PROJECT_ID=${PROJECT_ID},CLOUD_TASKS_LOCATION=${REGION},CLOUD_TASKS_QUEUE=dashchecker-outbox,CLOUD_TASKS_TARGET_URL=${CLOUD_TASKS_TARGET_URL},CLOUD_TASKS_AUDIENCE=${CLOUD_TASKS_AUDIENCE},CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL}" \
      --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest" \
      --set-secrets="DASHCHECKER_CRYPTO_KEYS_JSON=DASHCHECKER_CRYPTO_KEYS_JSON:latest" \
      --set-secrets="PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest" \
      --memory=512Mi --cpu=1 --task-timeout=300 --max-retries=3
  else
    gcloud run jobs create "dashchecker-${JOB}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --image="${IMAGE_URI}" \
      --command="node" --args="dist/job-main.js,${JOB}" \
      --service-account="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --set-env-vars="NODE_ENV=production,WORKER_ENABLED=true,WORKER_EXECUTION=run-once,JOB_NAME=${JOB}" \
      --set-env-vars="CLOUD_TASKS_PROJECT_ID=${PROJECT_ID},CLOUD_TASKS_LOCATION=${REGION},CLOUD_TASKS_QUEUE=dashchecker-outbox,CLOUD_TASKS_TARGET_URL=${CLOUD_TASKS_TARGET_URL},CLOUD_TASKS_AUDIENCE=${CLOUD_TASKS_AUDIENCE},CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=${CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL}" \
      --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest" \
      --set-secrets="DASHCHECKER_CRYPTO_KEYS_JSON=DASHCHECKER_CRYPTO_KEYS_JSON:latest" \
      --set-secrets="PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest" \
      --memory=512Mi --cpu=1 --task-timeout=300 --max-retries=3
  fi
done

echo "==> All jobs configured. Trigger manually to verify bounded pass:"
echo "    gcloud run jobs execute dashchecker-outbox-repair --region=${REGION} --project=${PROJECT_ID} --wait"
echo "    gcloud run jobs execute dashchecker-lease-recovery --region=${REGION} --project=${PROJECT_ID} --wait"

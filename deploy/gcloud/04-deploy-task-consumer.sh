#!/usr/bin/env bash
set -euo pipefail

# 04-deploy-task-consumer.sh – deploy private task-consumer Cloud Run service.
# Requires: PROJECT_ID, REGION, IMAGE_URI (with digest)
# Private (ingress=internal, no allow-unauthenticated), scales to zero,
# invokable ONLY by dashchecker-task-invoker OIDC.

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${IMAGE_URI:?IMAGE_URI is required}"
REGION="${REGION:-us-central1}"
SERVICE="dashchecker-task-consumer"

echo "==> Deploying private service ${SERVICE} from ${IMAGE_URI}"
echo "    Audience/target must equal the service URL + /internal/tasks/outbox"

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --ingress=internal \
  --no-allow-unauthenticated \
  --service-account="dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=0 \
  --timeout=30 \
  --cpu-throttling \
  --set-env-vars="NODE_ENV=production,WORKER_ENABLED=false,WORKER_EXECUTION=run-once" \
  --set-env-vars="CLOUD_TASKS_PROJECT_ID=${PROJECT_ID},CLOUD_TASKS_LOCATION=${REGION},CLOUD_TASKS_QUEUE=dashchecker-outbox" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest" \
  --set-secrets="DASHCHECKER_CRYPTO_KEYS_JSON=DASHCHECKER_CRYPTO_KEYS_JSON:latest" \
  --set-secrets="PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest" \
  --command="node" \
  --args="dist/task-main.js"

# After deploy, capture the URL and patch the env vars so target/audience are pinned.
TASK_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"
echo "==> Task consumer URL: ${TASK_URL}"

echo "==> Updating both services so CLOUD_TASKS_TARGET_URL/AUDIENCE == ${TASK_URL}/internal/tasks/outbox"
gcloud run services update "${SERVICE}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --set-env-vars="CLOUD_TASKS_TARGET_URL=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_AUDIENCE=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud run services update "dashchecker-api" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --set-env-vars="CLOUD_TASKS_TARGET_URL=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_AUDIENCE=${TASK_URL}/internal/tasks/outbox,CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Grant Cloud Run Invoker on task consumer to the task-invoker SA"
gcloud run services add-iam-policy-binding "${SERVICE}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --member="serviceAccount:dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

echo "==> Verify private ingress and OIDC:"
echo "    curl -f ${TASK_URL}/health/live  # should 403 without token"
echo "    gcloud run services describe ${SERVICE} --region=${REGION} --project=${PROJECT_ID} | grep -E 'ingress|serviceAccountName'"
echo "    gcloud run services get-iam-policy ${SERVICE} --region=${REGION} --project=${PROJECT_ID}"

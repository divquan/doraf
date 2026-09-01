#!/usr/bin/env bash
set -euo pipefail

# 01-service-accounts.sh – create service accounts and least-privilege IAM.
# Requires: PROJECT_ID, REGION
# Idempotent; verifies OIDC audience will be pinned to the task-consumer URL.

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

API_SA="dashchecker-api"
TASK_INVOKER_SA="dashchecker-task-invoker"
SCHEDULER_SA="dashchecker-scheduler"
# Google-managed Cloud Tasks service agent (format: service-PROJECT_NUMBER@gcp-sa-cloud-tasks.iam.gserviceaccount.com)
TASKS_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloud-tasks.iam.gserviceaccount.com"

create_sa() {
  local name="$1" display="$2"
  if ! gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Creating SA ${name}"
    gcloud iam service-accounts create "${name}" \
      --display-name="${display}" \
      --project="${PROJECT_ID}"
  else
    echo "==> SA ${name} exists"
  fi
}

create_sa "${API_SA}" "Dashchecker API runtime (creates Cloud Tasks)"
create_sa "${TASK_INVOKER_SA}" "Dashchecker Cloud Tasks OIDC invoker"
create_sa "${SCHEDULER_SA}" "Dashchecker Scheduler -> Cloud Run Jobs"

echo "==> Queue-level Cloud Tasks enqueuer for API SA will be bound in 02-queue.sh"
echo "    (scoped to projects/${PROJECT_ID}/locations/${REGION}/queues/dashchecker-outbox, not the whole project)"

echo "==> Grant Cloud Tasks service agent permission to mint OIDC tokens for task-invoker SA"
# Required for OIDC; see https://cloud.google.com/tasks/docs/creating-http-target-tasks#access_token
gcloud iam service-accounts add-iam-policy-binding "${TASK_INVOKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${TASKS_AGENT}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="${PROJECT_ID}" >/dev/null

echo "==> Scheduler SA needs to execute Cloud Run Jobs"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.jobsExecutor" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None >/dev/null

echo "==> Task consumer Cloud Run Invoker will be granted to task-invoker SA in 04-deploy-task-consumer.sh"
echo "    (requires the service URL to exist; that step binds roles/run.invoker on the service)"
echo "==> Done. Verify:"
echo "    gcloud iam service-accounts describe ${TASK_INVOKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com --project=${PROJECT_ID}"
echo "    gcloud iam service-accounts get-iam-policy ${TASK_INVOKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com --project=${PROJECT_ID}"

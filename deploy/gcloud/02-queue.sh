#!/usr/bin/env bash
set -euo pipefail

# 02-queue.sh – create Cloud Tasks queue dashchecker-outbox with pilot-appropriate policy.
# Reads: env.production (override with DEPLOY_ENV_FILE)
# Verifies retry/backoff/rate semantics expected by the outbox lease/repair mechanism.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"
QUEUE="${QUEUE:-dashchecker-outbox}"

# Pilot policy (documented in deploy/README.md and checked into deployment-todo.md):
# - maxAttempts: 10 (bounded retry, then platform stops; outbox-repair remains the lease-aware fallback)
# - minBackoff: 10s, maxBackoff: 600s, maxDoublings: 4 (10, 20, 40, 80, 160, 320, 600, 600, ...)
# - maxConcurrentDispatches: 50, maxDispatchesPerSecond: 100 (keeps DB connection demand under pooler limits)
# - maxRetryDuration: unbounded within attempts; task age limited by queue TTL (7d default)
# - Dead-letter: none in pilot; failed tasks are observable in queue metrics and remain FAILED in outbox.
#   For production, configure a dead-letter topic or alert on attempt-exhausted tasks.

if gcloud tasks queues describe "${QUEUE}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Queue ${QUEUE} in ${REGION} exists – updating to desired config"
  gcloud tasks queues update "${QUEUE}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --max-attempts=10 \
    --min-backoff=10s \
    --max-backoff=600s \
    --max-doublings=4 \
    --max-concurrent-dispatches=50 \
    --max-dispatches-per-second=100
else
  echo "==> Creating queue ${QUEUE} in ${REGION}"
  gcloud tasks queues create "${QUEUE}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --max-attempts=10 \
    --min-backoff=10s \
    --max-backoff=600s \
    --max-doublings=4 \
    --max-concurrent-dispatches=50 \
    --max-dispatches-per-second=100
fi

echo "==> Queue state:"
gcloud tasks queues describe "${QUEUE}" --location="${REGION}" --project="${PROJECT_ID}"

echo "==> Grant queue-scoped enqueuer to API runtime SA and Scheduler SA (outbox-repair)"
# Scoped to the single queue, not the whole project.
gcloud tasks queues add-iam-policy-binding "${QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:dashchecker-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer" >/dev/null

gcloud tasks queues add-iam-policy-binding "${QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer" >/dev/null

echo "==> Queue IAM after binding:"
gcloud tasks queues get-iam-policy "${QUEUE}" --location="${REGION}" --project="${PROJECT_ID}" 2>&1 | head -n 50 || true

echo "==> Verify unauthenticated task creation is not allowed (IAM enqueuer only);"
echo "    enqueue a staging task after services are deployed:"
echo "    gcloud tasks create-http-task --queue=${QUEUE} --location=${REGION} --project=${PROJECT_ID} \\"
echo "      --url=https://dashchecker-task-consumer-XXXX.a.run.app/internal/tasks/outbox \\"
echo "      --oidc-service-account-email=dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com \\"
echo "      --oidc-token-audience=https://dashchecker-task-consumer-XXXX.a.run.app/internal/tasks/outbox"

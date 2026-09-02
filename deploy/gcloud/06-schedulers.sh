#!/usr/bin/env bash
set -euo pipefail

# 06-schedulers.sh – create Cloud Scheduler jobs that invoke Cloud Run Jobs.
# Reads: env.production (override with DEPLOY_ENV_FILE)
# Each scheduler uses the dedicated scheduler SA; do not expose as public HTTP.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"

# Pilot cadence – adjust before production; bounded jobs must not be perpetual loops.
# Payment initialization and reconciliation stay frequent because they can affect
# checkout completion. The remaining jobs are repair, operational follow-up, or
# audit paths and can run less often without changing the immediate user path.
# Keep this as a regular array: macOS ships Bash 3.2, which does not support
# associative arrays.
SCHEDULES=(
  "outbox-repair|*/15 * * * *"
  "payment-initialization|*/2 * * * *"
  "payment-reconciliation|*/5 * * * *"
  "refund-reconciliation|0 * * * *"
  "withdrawal-reconciliation|0 * * * *"
  "lease-recovery|*/15 * * * *"
  "invariant-audit|0 3 * * *"
)

for ENTRY in "${SCHEDULES[@]}"; do
  JOB="${ENTRY%%|*}"
  SCHED="${ENTRY#*|}"
  NAME="dashchecker-${JOB}"
  echo "==> Creating/updating scheduler ${NAME} -> run job dashchecker-${JOB} on ${SCHED}"

  # Cloud Scheduler invokes the regional Cloud Run Admin API v2 endpoint with
  # an OAuth access token. Cloud Run Jobs accept roles/run.invoker on the job.

  # Check existence
  if gcloud scheduler jobs describe "${NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Updating existing Scheduler job ${NAME}"
    gcloud scheduler jobs update http "${NAME}" \
      --location="${REGION}" --project="${PROJECT_ID}" \
      --schedule="${SCHED}" \
      --time-zone="Africa/Accra" \
      --uri="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/dashchecker-${JOB}:run" \
      --http-method=POST \
      --oauth-service-account-email="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=300s \
      --max-retry-attempts=3 \
      --min-backoff=10s \
      --max-backoff=300s
  else
    echo "==> Creating new Scheduler job ${NAME}"
    gcloud scheduler jobs create http "${NAME}" \
      --location="${REGION}" --project="${PROJECT_ID}" \
      --schedule="${SCHED}" \
      --time-zone="Africa/Accra" \
      --uri="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/dashchecker-${JOB}:run" \
      --http-method=POST \
      --oauth-service-account-email="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=300s \
      --max-retry-attempts=3 \
      --min-backoff=10s \
      --max-backoff=300s
  fi
done

echo "==> All schedulers configured. Verify Cloud Run Jobs Admin API endpoint:"
echo "    Expected URI pattern: https://run.googleapis.com/v2/projects/\${PROJECT_ID}/locations/\${REGION}/jobs/dashchecker-<JOB>:run"
echo "    Expected OAuth scope: https://www.googleapis.com/auth/cloud-platform"
for ENTRY in "${SCHEDULES[@]}"; do
  JOB="${ENTRY%%|*}"
  echo "    -- dashchecker-${JOB}:"
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.uri)' 2>&1 | sed 's/^/       uri: /' || true
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.oauthToken.serviceAccountEmail)' 2>&1 | sed 's/^/       oauth SA: /' || true
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.oauthToken.scope)' 2>&1 | sed 's/^/       oauth scope: /' || true
done
echo "    gcloud scheduler jobs list --location=${REGION} --project=${PROJECT_ID}"

#!/usr/bin/env bash
set -euo pipefail

# 06-schedulers.sh – create Cloud Scheduler jobs that invoke Cloud Run Jobs.
# Requires: PROJECT_ID, REGION
# Each scheduler uses the dedicated scheduler SA; do not expose as public HTTP.

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"

# Pilot cadence – adjust before production; bounded jobs must not be perpetual loops.
# Frequencies balance recovery latency vs. DB/provider load.
declare -A SCHEDULES=(
  ["outbox-repair"]="*/5 * * * *"
  ["payment-initialization"]="*/2 * * * *"
  ["payment-reconciliation"]="*/5 * * * *"
  ["refund-reconciliation"]="*/10 * * * *"
  ["withdrawal-reconciliation"]="*/10 * * * *"
  ["lease-recovery"]="*/5 * * * *"
  ["invariant-audit"]="0 * * * *"
)

for JOB in "${!SCHEDULES[@]}"; do
  SCHED="${SCHEDULES[$JOB]}"
  NAME="dashchecker-${JOB}"
  echo "==> Creating/updating scheduler ${NAME} -> run job dashchecker-${JOB} on ${SCHED}"

  # Scheduler -> Cloud Run Jobs uses HTTP target with OIDC or gcloud run jobs execute integration.
  # We use the Cloud Scheduler -> Cloud Run Jobs execution via `gcloud scheduler jobs create http`
  # targeting the Run Jobs execution API. Simpler portable form:
  #   gcloud scheduler jobs create http <name> --schedule --uri https://REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT/jobs/dashchecker-JOB:run

  # Check existence
  if gcloud scheduler jobs describe "${NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${NAME}" \
      --location="${REGION}" --project="${PROJECT_ID}" \
      --schedule="${SCHED}" \
      --time-zone="Africa/Accra" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/dashchecker-${JOB}:run" \
      --http-method=POST \
      --oidc-service-account-email="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --oidc-token-audience="https://${REGION}-run.googleapis.com/" \
      --attempt-deadline=300s \
      --max-retry-attempts=3 \
      --min-backoff=10s \
      --max-backoff=300s
  else
    gcloud scheduler jobs create http "${NAME}" \
      --location="${REGION}" --project="${PROJECT_ID}" \
      --schedule="${SCHED}" \
      --time-zone="Africa/Accra" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/dashchecker-${JOB}:run" \
      --http-method=POST \
      --oidc-service-account-email="dashchecker-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
      --oidc-token-audience="https://${REGION}-run.googleapis.com/" \
      --attempt-deadline=300s \
      --max-retry-attempts=3 \
      --min-backoff=10s \
      --max-backoff=300s
  fi
done

echo "==> All schedulers configured. Verify regional Run Jobs endpoint:"
echo "    Expected URI pattern: https://\${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/\${PROJECT_ID}/jobs/dashchecker-<JOB>:run"
echo "    Expected audience: https://\${REGION}-run.googleapis.com/ (regional Run API, pinned per job)"
for JOB in "${!SCHEDULES[@]}"; do
  echo "    -- dashchecker-${JOB}:"
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.uri)' 2>&1 | sed 's/^/       uri: /' || true
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.oidcToken.serviceAccountEmail)' 2>&1 | sed 's/^/       oidc SA: /' || true
  gcloud scheduler jobs describe "dashchecker-${JOB}" --location="${REGION}" --project="${PROJECT_ID}" \
    --format='value(httpTarget.oidcToken.audience)' 2>&1 | sed 's/^/       audience: /' || true
done
echo "    gcloud scheduler jobs list --location=${REGION} --project=${PROJECT_ID}"

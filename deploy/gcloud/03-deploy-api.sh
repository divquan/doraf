#!/usr/bin/env bash
set -euo pipefail

# 03-deploy-api.sh – deploy public API Cloud Run service.
# Requires: PROJECT_ID, REGION, IMAGE_URI (with digest), DATABASE_URL secret, etc.
# Public, scale-to-zero, WORKER_ENABLED=false, no Redis.

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${IMAGE_URI:?IMAGE_URI is required (e.g., us-central1-docker.pkg.dev/PROJECT/REPO/dashchecker-api:SHA@sha256:...) }"
REGION="${REGION:-us-central1}"
SERVICE="dashchecker-api"

# Example: IMAGE_URI=us-central1-docker.pkg.dev/PROJECT/dashchecker/dashchecker-api:abc123@sha256:...

echo "==> Deploying public service ${SERVICE} from ${IMAGE_URI}"

# Secrets are bound via --set-secrets; never via --set-env-vars or build args.
# Create secrets beforehand:
#   echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=- --project="$PROJECT_ID" --replication-policy=automatic
#   # DASHCHECKER_CRYPTO_KEYS_JSON must contain nine distinct 32-byte base64 values (no reuse):
#   # for k in VOUCHER_MASTER_KEY_BASE64 VOUCHER_FINGERPRINT_KEY_BASE64 SESSION_FINGERPRINT_KEY_BASE64 INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64 AGENT_PHONE_ENCRYPTION_KEY_BASE64 AGENT_PHONE_FINGERPRINT_KEY_BASE64 OTP_FINGERPRINT_KEY_BASE64 ORDER_CONTACT_ENCRYPTION_KEY_BASE64 ORDER_CONTACT_FINGERPRINT_KEY_BASE64; do v=$(openssl rand -base64 32); echo "  $k=$v"; done
#   # Then: printf '%s' '{"VOUCHER_MASTER_KEY_BASE64":"...","VOUCHER_FINGERPRINT_KEY_BASE64":"...","SESSION_FINGERPRINT_KEY_BASE64":"...","INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64":"...","AGENT_PHONE_ENCRYPTION_KEY_BASE64":"...","AGENT_PHONE_FINGERPRINT_KEY_BASE64":"...","OTP_FINGERPRINT_KEY_BASE64":"...","ORDER_CONTACT_ENCRYPTION_KEY_BASE64":"...","ORDER_CONTACT_FINGERPRINT_KEY_BASE64":"..."}' | gcloud secrets create DASHCHECKER_CRYPTO_KEYS_JSON --data-file=- --project="$PROJECT_ID" --replication-policy=automatic
# Repeat for DIRECT_URL, PAYSTACK_SECRET_KEY, INTERNAL_AUTH_*, etc.
# This script assumes the secret names match the env var names.

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --ingress=all \
  --allow-unauthenticated \
  --service-account="dashchecker-api@${PROJECT_ID}.iam.gserviceaccount.com" \
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
  --set-env-vars="CLOUD_TASKS_TARGET_URL=https://dashchecker-task-consumer-REPLACE_ME.a.run.app/internal/tasks/outbox" \
  --set-env-vars="CLOUD_TASKS_AUDIENCE=https://dashchecker-task-consumer-REPLACE_ME.a.run.app/internal/tasks/outbox" \
  --set-env-vars="CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=dashchecker-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest" \
  --set-secrets="DASHCHECKER_CRYPTO_KEYS_JSON=DASHCHECKER_CRYPTO_KEYS_JSON:latest" \
  --set-secrets="PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest" \
  --command="node" \
  --args="dist/main.js"

echo "==> Service ${SERVICE} deployed. Verify:"
echo "    gcloud run services describe ${SERVICE} --region=${REGION} --project=${PROJECT_ID} --format='value(status.url)'"
echo "    curl -f \$(gcloud run services describe ${SERVICE} --region=${REGION} --project=${PROJECT_ID} --format='value(status.url)')/health/live"
echo "    gcloud run services describe ${SERVICE} --region=${REGION} --project=${PROJECT_ID} | grep -E 'image:|serviceAccountName:|maxInstanceCount'"

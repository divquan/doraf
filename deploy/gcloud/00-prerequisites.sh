#!/usr/bin/env bash
set -euo pipefail

# 00-prerequisites.sh – enable required APIs and create Artifact Registry.
# Reads: env.production (override with DEPLOY_ENV_FILE)

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-dashchecker}"

echo "==> Enabling APIs for project ${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Creating Artifact Registry repository ${REPOSITORY} in ${REGION} (if absent)"
gcloud artifacts repositories describe "${REPOSITORY}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="dashchecker immutable images"

echo "==> Done. Next: 01-service-accounts.sh"

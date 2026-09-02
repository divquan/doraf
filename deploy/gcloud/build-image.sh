#!/usr/bin/env bash
set -euo pipefail

# build-image.sh – build and publish the production image from this local source tree.
# Reads: env.production (override with DEPLOY_ENV_FILE)
# Outputs IMAGE_URI with the immutable Artifact Registry digest.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env.sh
source "${SCRIPT_DIR}/load-env.sh"

: "${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-dashchecker}"
BUILD_REGION="${BUILD_REGION:-global}"

REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ ! -f "${REPO_ROOT}/Dockerfile" || ! -f "${REPO_ROOT}/cloudbuild.yaml" ]]; then
  echo "ERROR: Dockerfile and cloudbuild.yaml must exist at ${REPO_ROOT}" >&2
  exit 1
fi

echo "==> Uploading local source tree: ${REPO_ROOT}"
echo "==> Starting Cloud Build in region ${BUILD_REGION}"
BUILD_ID="$(
  gcloud builds submit "${REPO_ROOT}" \
    --config="${REPO_ROOT}/cloudbuild.yaml" \
    --project="${PROJECT_ID}" \
    --region="${BUILD_REGION}" \
    --substitutions="_PROJECT_ID=${PROJECT_ID},_REGION=${REGION},_REPOSITORY=${REPOSITORY}" \
    --async \
    --format='value(id)'
)"

if [[ -z "${BUILD_ID}" ]]; then
  echo "ERROR: Cloud Build did not return a build ID." >&2
  exit 1
fi

echo "==> Streaming Cloud Build ${BUILD_ID}"
gcloud builds log "${BUILD_ID}" \
  --project="${PROJECT_ID}" \
  --region="${BUILD_REGION}" \
  --stream

STATUS="$(gcloud builds describe "${BUILD_ID}" \
  --project="${PROJECT_ID}" \
  --region="${BUILD_REGION}" \
  --format='value(status)')"
if [[ "${STATUS}" != "SUCCESS" ]]; then
  echo "ERROR: Cloud Build ${BUILD_ID} finished with status ${STATUS}." >&2
  exit 1
fi

IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/dashchecker-api:${BUILD_ID}"
DIGEST="$(gcloud artifacts docker images describe "${IMAGE_TAG}" \
  --project="${PROJECT_ID}" \
  --format='value(image_summary.digest)')"
if [[ ! "${DIGEST}" =~ ^sha256:[a-fA-F0-9]{64}$ ]]; then
  echo "ERROR: Could not resolve an immutable digest for ${IMAGE_TAG}." >&2
  exit 1
fi

IMAGE_URI="${IMAGE_TAG}@${DIGEST}"
echo "==> Build succeeded"
echo "IMAGE_URI=${IMAGE_URI}"
echo "Export for deployment: export IMAGE_URI='${IMAGE_URI}'"

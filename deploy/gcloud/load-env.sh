#!/usr/bin/env bash

# Load the repository's local production deployment configuration.
#
# This file is sourced by the deployment scripts, not executed directly. Keep
# env.production untracked: it is an operator-local configuration file and may
# contain deployment-specific values that should not be committed.

LOAD_ENV_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_REPO_ROOT="$(cd -- "${LOAD_ENV_DIR}/../.." && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${DEPLOY_REPO_ROOT}/env.production}"

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "ERROR: deployment env file not found: ${DEPLOY_ENV_FILE}" >&2
  echo "Copy ${DEPLOY_REPO_ROOT}/.env.example.production to ${DEPLOY_REPO_ROOT}/env.production and fill in the deployment values." >&2
  exit 1
fi

echo "==> Loading deployment environment from ${DEPLOY_ENV_FILE}"
set -a
# shellcheck disable=SC1090
source "${DEPLOY_ENV_FILE}"
set +a

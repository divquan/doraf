#!/usr/bin/env bash
set -euo pipefail

# create-crypto-secret.sh - create the bundled Dashchecker cryptographic secret.
#
# Requires: PROJECT_ID
# Optional: GRANT_ACCESS=true after 01-service-accounts.sh has run.
# Refuses to replace an existing secret because changing these keys can make
# existing encrypted data or fingerprints unreadable.

: "${PROJECT_ID:?PROJECT_ID is required}"
SECRET_NAME="DASHCHECKER_CRYPTO_KEYS_JSON"
GRANT_ACCESS="${GRANT_ACCESS:-false}"

command -v gcloud >/dev/null || {
  echo "gcloud is required" >&2
  exit 1
}
command -v openssl >/dev/null || {
  echo "openssl is required" >&2
  exit 1
}

if gcloud secrets describe "${SECRET_NAME}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Secret ${SECRET_NAME} already exists in ${PROJECT_ID}." >&2
  echo "Refusing to generate replacement keys; rotate only with a migration plan." >&2
  exit 1
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/dashchecker-crypto.XXXXXX")"
secret_file="${temporary_directory}/crypto-keys.json"

cleanup() {
  rm -f "${secret_file}"
  rmdir "${temporary_directory}" 2>/dev/null || true
}
trap cleanup EXIT

umask 077

voucher_master="$(openssl rand -base64 32)"
voucher_fingerprint="$(openssl rand -base64 32)"
session_fingerprint="$(openssl rand -base64 32)"
enrollment_fingerprint="$(openssl rand -base64 32)"
agent_phone_encryption="$(openssl rand -base64 32)"
agent_phone_fingerprint="$(openssl rand -base64 32)"
otp_fingerprint="$(openssl rand -base64 32)"
order_contact_encryption="$(openssl rand -base64 32)"
order_contact_fingerprint="$(openssl rand -base64 32)"

distinct_count="$(
  printf '%s\n' \
    "${voucher_master}" \
    "${voucher_fingerprint}" \
    "${session_fingerprint}" \
    "${enrollment_fingerprint}" \
    "${agent_phone_encryption}" \
    "${agent_phone_fingerprint}" \
    "${otp_fingerprint}" \
    "${order_contact_encryption}" \
    "${order_contact_fingerprint}" |
    sort -u |
    wc -l |
    tr -d ' '
)"

if [[ "${distinct_count}" != "9" ]]; then
  echo "Generated key collision; refusing to continue." >&2
  exit 1
fi

printf '{"VOUCHER_MASTER_KEY_BASE64":"%s","VOUCHER_FINGERPRINT_KEY_BASE64":"%s","SESSION_FINGERPRINT_KEY_BASE64":"%s","INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64":"%s","AGENT_PHONE_ENCRYPTION_KEY_BASE64":"%s","AGENT_PHONE_FINGERPRINT_KEY_BASE64":"%s","OTP_FINGERPRINT_KEY_BASE64":"%s","ORDER_CONTACT_ENCRYPTION_KEY_BASE64":"%s","ORDER_CONTACT_FINGERPRINT_KEY_BASE64":"%s"}\n' \
  "${voucher_master}" \
  "${voucher_fingerprint}" \
  "${session_fingerprint}" \
  "${enrollment_fingerprint}" \
  "${agent_phone_encryption}" \
  "${agent_phone_fingerprint}" \
  "${otp_fingerprint}" \
  "${order_contact_encryption}" \
  "${order_contact_fingerprint}" >"${secret_file}"

gcloud secrets create "${SECRET_NAME}" \
  --replication-policy=automatic \
  --project="${PROJECT_ID}"

gcloud secrets versions add "${SECRET_NAME}" \
  --data-file="${secret_file}" \
  --project="${PROJECT_ID}"

if [[ "${GRANT_ACCESS}" == "true" ]]; then
  for account in dashchecker-api dashchecker-task-invoker dashchecker-scheduler; do
    gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
      --project="${PROJECT_ID}" \
      --member="serviceAccount:${account}@${PROJECT_ID}.iam.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor" >/dev/null
  done
fi

echo "Created ${SECRET_NAME} in project ${PROJECT_ID}."
if [[ "${GRANT_ACCESS}" == "true" ]]; then
  echo "Granted Secret Manager access to the API, task-consumer, and scheduler service accounts."
else
  echo "Run after service-account setup with GRANT_ACCESS=true to grant runtime access."
fi

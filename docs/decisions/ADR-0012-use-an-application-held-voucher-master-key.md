# ADR-0012: Use an application-held voucher master key

Status: Accepted
Date: 2026-07-31

## Context

Doraf needs application-layer encryption for high-value voucher serials and
PINs, but operating Google Cloud KMS adds a provider dependency and recurring
key-management complexity that is disproportionate during the MVP.

## Decision

Use a 32-byte `VOUCHER_MASTER_KEY_BASE64` runtime secret to wrap a fresh random
AES-256 data key for each imported inventory batch. Voucher serials and PINs
remain separately encrypted with AES-256-GCM under their batch data key. The
database stores only the nonce, authentication tag, and ciphertext of each
wrapped batch key; it never stores the master key or an unwrapped batch key.

Use an independent `VOUCHER_FINGERPRINT_KEY_BASE64` for duplicate-detection
HMACs. The two values must never be reused for another purpose.

The master key is injected at runtime and excluded from source control,
database backups, logs, browser bundles, and ordinary support access. Before
any real inventory import, record two independent, access-controlled recovery
copies and test restoration against a non-production database backup. Rotation
requires a documented rewrapping process; do not replace the current key until
all retained batches have been verified recoverable.

## Consequences

- Google Cloud KMS and its SDK are not required by the API.
- Local development can import encrypted inventory using a locally generated
  master key.
- The platform must maintain its own access, backup, recovery, rotation, and
  compromise procedures for the master key.
- A lost master key makes affected voucher values and their backups unreadable.
- A compromised master key requires voucher quarantine, key replacement, and
  controlled rewrapping or replacement of affected inventory.

## Supersedes

This supersedes only the Google Cloud KMS voucher-key-management portion of
[ADR-0010](ADR-0010-use-supabase-and-google-cloud-serverless.md). Google Cloud
Run, Storage, Secret Manager, Tasks, Pub/Sub, Scheduler, and Logging remain
the selected hosted services.

## Alternatives considered

### Google Cloud KMS

Rejected for the MVP because the provider-managed key service is not required
to preserve the envelope-encryption design and adds operational cost and
dependency.

### Self-hosted HashiCorp Vault Transit

Rejected because operating Vault safely requires independent storage, sealing,
backup, recovery, and availability work beyond the MVP's needs.

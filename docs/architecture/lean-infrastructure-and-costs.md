# Lean Google Cloud and Supabase infrastructure

Status: Accepted direction
Last updated: 2026-07-30

This baseline supersedes the AWS-first MVP baseline in
[ADR-0009](../decisions/ADR-0009-use-aws-cape-town-for-mvp-infrastructure.md).
It prioritizes scale-to-zero services and a very low pilot cost while preserving
PostgreSQL and the confirmed transaction model.

## Service allocation

| Capability | Service |
| --- | --- |
| Agent web | Google Cloud Run |
| Administration web | Google Cloud Run |
| API | Google Cloud Run |
| Asynchronous execution | Google Cloud Tasks and Pub/Sub push to Cloud Run |
| Scheduled sweeps and reconciliation | Cloud Scheduler and Cloud Run Jobs |
| PostgreSQL | Supabase |
| Complaint evidence and generated exports | Google Cloud Storage |
| Application and provider secrets | Google Secret Manager |
| Voucher encryption keys | Application-held runtime master key |
| Runtime logs and metrics | Google Cloud Logging and Monitoring |
| Durable business audit and reconciliation | Supabase PostgreSQL |

Cloud Run services use scale-to-zero and explicit maximum-instance limits.
There is no permanently running `pg-boss` worker in this deployment model.
Transactional outbox records remain canonical; a scheduled dispatcher repairs
any failure between a database commit and task publication.

## Regions

Supabase does not currently offer an African project Region. Start with the
specific Ireland region (`eu-west-1`) and place Google Cloud transactional
compute in a nearby European Region selected by measured database latency.

Do not run the API in Johannesburg merely because it is geographically closer
to Ghana if every transaction must then cross continents to PostgreSQL.
Static assets can still be delivered globally.

The final Google Cloud Region requires a Ghana-to-service and
service-to-database latency test. Both Supabase and Google Cloud remain
cross-border processors requiring the confirmed privacy review.

## Database tiers

### Development and closed pilot

Supabase Free provides:

- 500 MB database size,
- shared CPU and 500 MB RAM,
- 5 GB direct and 5 GB cached egress,
- two active projects, and
- no monthly subscription.

It also:

- pauses after one week of inactivity,
- has no automatic backups, and
- has no production availability commitment suitable for Doraf.

Therefore the Free plan must not process meaningful live customer money.
Create a scheduled encrypted off-site `pg_dump` even during the pilot.

### Live launch

Supabase Pro is the minimum live tier:

- $25 per month,
- one Micro project covered by the included compute credit,
- 8 GB database disk,
- no inactivity pause, and
- daily backups retained for seven days.

Daily backups alone allow up to approximately one day of data loss. Add
frequent encrypted logical backups to separate storage and test restoration.
Supabase point-in-time recovery is a later paid control; its current seven-day
option is approximately $100 per month in addition to the Pro plan.

No recovery objective is considered achieved until a timed restore exercise
measures it.

## File storage

Supabase is used for PostgreSQL only. Use private Google Cloud Storage buckets:

- `dispute-evidence-quarantine`
- `dispute-evidence-clean`
- `generated-exports`

Rules:

- Never use public buckets.
- Access is server-mediated and protected by least-privilege Cloud IAM.
- Issue short-lived signed URLs only after API authorization.
- Restrict MIME types and file sizes at the API layer and upload policy.
- Malware-scan evidence before moving it from quarantine to clean storage.
- Encrypt sensitive evidence before upload using application envelope
  encryption.
- Keep object keys opaque and free of phone numbers or order details.
- Expire exports automatically under the retention schedule.
- Enable access logging and audit upload, read, signed-link creation, and
  deletion.

Use lifecycle policies for retention and, before meaningful live operation,
versioning or a separate recovery copy according to the approved recovery
objective. Database backups do not contain these objects.

## Secrets

Use Google Secret Manager for:

- Supabase direct and pooled database credentials,
- Paystack secret and webhook material,
- SMS provider credential,
- email provider credential,
- USSD provider credential,
- OTP/session signing material, and
- the HMAC fingerprint key.

Do not combine unrelated providers into one secret solely to remain under a
free quota. Separate secrets reduce blast radius and allow independent
rotation.

Google currently includes six active secret versions and 10,000 accesses each
month. Additional software secret versions cost about $0.06 each per month and
additional access is $0.03 per 10,000 operations. At the expected MVP set,
Secret Manager should cost approximately $0.12–$0.50 per month.

Cloud Run reads secrets at startup or through a controlled runtime client.
Rotation includes replacing tasks or confirming runtime refresh. Secret values
never enter repository variables, build arguments, logs, or browser bundles.

## Application encryption

Supabase database encryption at rest is not a substitute for application-layer
voucher encryption because database readers must not see plaintext vouchers.

Use envelope encryption:

1. An application-held 32-byte master key protects a data-encryption key.
2. Doraf encrypts voucher serial/PIN pairs with AES-256-GCM.
3. A unique nonce and authenticated record context prevent ciphertext reuse or
   substitution.
4. Store ciphertext, wrapped data key, nonce, algorithm version, and master-key
   version in PostgreSQL.
5. Remove plaintext keys and voucher values from memory as soon as practical.

Keep the voucher master key and HMAC fingerprint key separate and under
distinct access policies. Recovery copies and rotation follow ADR-0012.

Using a data key per inventory batch or bounded group keeps the master key out
of the database and avoids a per-operation key-management dependency.

## Logs, metrics, and audit

Cloud Run writes structured application output to Cloud Logging. Use:

- allowlisted JSON fields,
- correlation IDs,
- severity and safe error codes,
- metrics for payment, delivery, queue, inventory, and reconciliation health,
  and
- alerts with an owner and runbook.

Never log:

- voucher serials or PINs,
- OTPs or session tokens,
- provider secrets,
- database credentials,
- full phone numbers or email addresses,
- synthetic Paystack emails, or
- unfiltered webhook/provider payloads.

Google currently includes the first 50 GiB of logs per project per month and
30-day retention. A small Doraf launch should remain at $0. Exclude routine
health checks, avoid debug logging in production, and alarm on ingestion growth.

Cloud logs support operations; they are not Doraf's durable audit ledger.
Business audit, payment events, inventory events, wallet entries, and
reconciliation facts remain append-only PostgreSQL records.

## Expected infrastructure cost

| Stage | Supabase | Google services | Expected total |
| --- | ---: | ---: | ---: |
| Local development | $0 | $0 | $0 |
| Closed hosted pilot | $0 | $0–$2 | $0–$2/month |
| Small live launch | $25 | $0–$5 | $25–$30/month |
| Live launch with Supabase PITR | $125 | $0–$5 | $125–$130/month |

These figures exclude domain registration, Paystack fees, SMS, email, USSD,
tax, and WAEC inventory.

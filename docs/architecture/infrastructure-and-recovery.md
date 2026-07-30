# Infrastructure, observability, and recovery baseline

Status: Superseded by ADR-0010
Last updated: 2026-07-30

This is the MVP production baseline. Exact resource sizes remain configurable
and must be load-tested; the security, isolation, backup, and recovery
properties are requirements.

## Cloud and regions

- Use AWS as the primary cloud.
- Run production in `af-south-1` (Africa, Cape Town) across at least two
  Availability Zones.
- Use `eu-west-1` (Europe, Ireland) as the disaster-recovery Region.
- Treat both locations as cross-border processing from Ghana and complete the
  required privacy, contract, and data-transfer review before production.
- Validate Ghana-to-Cape Town latency, every required AWS service, and
  Cape Town-to-Ireland backup replication in a production-shaped environment.
  If a required service or recovery path is unavailable, record an ADR before
  changing the primary or recovery Region.

Cape Town is selected as the closest AWS Region on the African continent, not
as a claim that Ghanaian data-residency requirements are automatically met.

## AWS account and environment isolation

Use AWS Organizations with separate accounts:

- production,
- non-production, and
- security/log archive.

Production and non-production have separate networks, databases, KMS keys,
secrets, buckets, provider credentials, DNS names, and payment modes.

Human production access uses federated identity, MFA, short-lived roles, and
audited elevation. CI/CD uses workload identity federation and short-lived AWS
credentials; static AWS access keys are prohibited.

## Network

- One production VPC spans at least two Availability Zones.
- Only public load balancers and required edge services accept internet traffic.
- Application tasks, worker tasks, RDS, and internal service endpoints use
  private subnets.
- RDS has no public endpoint.
- Security groups permit only explicitly required service-to-service paths.
- Use VPC endpoints where they materially reduce public egress for AWS services.
- Restrict outbound traffic where practical while retaining required provider
  access.

Route 53 provides DNS. CloudFront and AWS WAF protect public web traffic.
Application Load Balancers route to the web and API services. Provider webhook
routes are never cached and retain provider-specific verification and rate
controls.

## Compute and deployment

Use Amazon ECS on AWS Fargate with images in Amazon ECR.

Run independent ECS services for:

- agent web,
- administration web,
- API, and
- worker.

The API and web services run at least two production tasks across Availability
Zones. Worker count and concurrency are independently controlled. A deployment
must preserve enough healthy capacity to receive checkout and provider webhook
traffic.

Use immutable image digests, health checks, rolling or blue/green deployment,
and automated rollback on failed health or error-rate alarms. Do not build
production images on production hosts.

Infrastructure is defined using AWS CDK in TypeScript. Console-only production
resources are prohibited except documented emergency actions that are
subsequently reconciled into code.

## PostgreSQL and queue

Use an encrypted Amazon RDS for PostgreSQL Multi-AZ DB instance:

- private subnets,
- customer-managed KMS key,
- TLS-required connections,
- deletion protection,
- storage autoscaling with alarms,
- performance monitoring,
- 35-day automated-backup retention, and
- point-in-time recovery enabled.

Use a dedicated application database role, a restricted migration role, and
separate API and worker connection pools. Do not use the RDS master credential
for application traffic.

`pg-boss` uses a dedicated PostgreSQL schema and worker pool. Queue concurrency,
database connections, job age, dead letters, and outbox dispatch lag are
monitored. Queue work must yield to checkout, webhook, and financial
transactions under database pressure.

Production does not use a single-AZ database. Development and ephemeral test
environments may use cheaper configurations without weakening production
infrastructure code or database tests.

## Object storage

Use separate private S3 buckets or access boundaries for:

- complaint evidence and its quarantine area,
- generated exports, and
- security/audit log archive.

Requirements:

- S3 Block Public Access enabled,
- bucket-owner-enforced ownership,
- versioning enabled,
- TLS-only bucket policy,
- SSE-KMS with purpose-specific customer-managed keys,
- least-privilege task roles,
- short-lived presigned access after application authorization,
- access logging and sensitive-read audit,
- malware scanning before evidence becomes available, and
- lifecycle expiry based on the approved retention schedule.

Exports and evidence are never served from a public bucket or permanent object
URL. The log archive uses retention protection appropriate to the final legal
schedule.

## Voucher encryption and key management

Use application-layer envelope encryption for voucher serial/PIN pairs:

1. AWS KMS protects a customer-managed voucher key-encryption key.
2. The importer obtains a data-encryption key for a batch or bounded encryption
   unit.
3. The application encrypts each secret using an authenticated algorithm such
   as AES-256-GCM with a unique nonce and authenticated record context.
4. The encrypted data key, ciphertext, nonce, algorithm version, and KMS key
   identifier are stored; plaintext keys are removed from memory promptly.

The encryption context binds data to its Doraf purpose and environment. The API
and worker receive only the narrow KMS permissions they need. Administrator and
Support browser sessions never receive general decrypt capability.

The keyed HMAC duplicate-detection key is separate from the voucher encryption
key and stored through Secrets Manager under a separate KMS key and IAM policy.
HMAC fingerprints cannot be used to recover plaintext.

Key rotation adds new key versions and rewraps data keys where possible.
Disabling or deleting a key requires a reviewed procedure because it can make
inventory, sold-voucher recovery, backups, or evidence unreadable.

## Application and provider secrets

Use AWS Secrets Manager for:

- database credentials,
- Paystack secrets,
- SMS, email, and USSD credentials,
- session and OTP signing material where applicable, and
- the HMAC fingerprint key.

ECS task roles grant access to specific secrets. Rotation requires a controlled
task redeployment or runtime refresh; changing a secret alone is not assumed to
update a running container. Secrets, plaintext data keys, and voucher values
must never enter logs, traces, crash reports, image layers, or CI output.

## Observability

Use CloudWatch as the primary production observability and alerting platform:

- structured JSON logs with explicit redaction,
- CloudWatch metrics and dashboards,
- OpenTelemetry traces and service metrics,
- RDS performance and connection metrics,
- ECS task and deployment health,
- CloudTrail activity delivered to the security account, and
- alarms routed to an owned on-call channel.

Use correlation IDs across HTTP requests, outbox records, jobs, and provider
calls. Do not put phone numbers, email addresses, synthetic Paystack emails,
voucher values, OTPs, provider secrets, or unfiltered provider payloads in
telemetry.

Critical alerts include:

- checkout or payment-acceptance error rate,
- webhook authentication or processing failures,
- paid orders without completed commercial commit,
- outbox or queue age and dead letters,
- delivery backlog and unknown provider results,
- inventory exhaustion and quarantine spikes,
- duplicate/invariant check failures,
- ledger or reconciliation discrepancies,
- withdrawal/refund/transfer failures or unusual volume,
- RDS availability, storage, connections, latency, and replica/backup health,
- KMS denial or unusual decrypt volume, and
- backup or restore-test failure.

Every production alert has a severity, owner, response target, and runbook.
High-cardinality identifiers stay in safe logs rather than metric labels.

## Availability and recovery objectives

Targets apply to Doraf-controlled systems and exclude a separately measured
provider outage:

| Failure scope | RPO | RTO |
| --- | ---: | ---: |
| Application task or single Availability Zone | effectively zero committed database loss | 15 minutes |
| Recoverable database error within the primary Region | 5 minutes | 60 minutes |
| Complete primary-Region loss | 30 minutes | 4 hours |

The production service objective is 99.9% monthly availability for checkout,
payment callback acceptance, and buyer recovery, measured separately from
provider availability.

These are engineering targets, not claims that AWS alone guarantees the
business outcome.

## Backup and disaster recovery

- RDS automated backups and transaction logs provide 35-day point-in-time
  recovery in the primary Region.
- Replicate RDS automated backups to Ireland with a destination KMS key and
  monitor replication lag.
- Cross-Region replication is asynchronous; alert before lag breaches the
  30-minute RPO.
- Copy required S3 recovery data to the recovery Region using an approved
  encrypted mechanism consistent with retention and deletion obligations.
- Replicate required Secrets Manager secrets and provision independent recovery
  KMS keys without sharing plaintext key material.
- Keep recovery-region infrastructure deployable from CDK, but do not run a
  fully active second application stack for MVP.
- Preserve provider event evidence and reconcile all payments, refunds,
  transfers, vouchers, and ledger effects after recovery.

If the selected Region pair does not support the required RDS backup
replication, production is blocked until an alternative meeting the target is
implemented, such as a cross-Region PostgreSQL read replica or a revised,
explicitly approved objective.

## Testing and operations

- Restore RDS into an isolated environment at least quarterly.
- Test a cross-Region recovery at least twice per year and before launch.
- Test object recovery, KMS access, secret restoration, DNS switching,
  application redeployment, queue resumption, and financial reconciliation.
- Measure achieved RPO and RTO rather than recording only procedural success.
- Test Multi-AZ database failover and worker crash recovery.
- Record every exercise, gap, owner, and remediation date.
- Review capacity, cost, recovery objectives, and single-cloud concentration
  after launch using measured demand.

## Explicitly deferred

- active-active multi-Region writes,
- Kubernetes,
- a Redis or standalone message broker,
- a production read replica used only for reporting,
- a full hot standby Region, and
- multi-cloud portability work without a demonstrated requirement.

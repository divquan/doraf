# ADR-0009: Use AWS Cape Town for MVP infrastructure

Status: Superseded by ADR-0010
Date: 2026-07-30

## Context

Dashchecker processes payments, agent earnings, high-value voucher secrets, and
personal data. It needs managed relational storage, durable object storage,
controlled encryption keys, environment isolation, observability, and tested
recovery without operating several unrelated infrastructure platforms.

No AWS Region exists in Ghana. Region choice is therefore also a cross-border
processing and recovery decision.

## Decision

Use AWS as the primary MVP cloud.

- Primary Region: `af-south-1` (Africa, Cape Town)
- Recovery Region: `eu-west-1` (Europe, Ireland)
- Compute: ECS on Fargate
- Images: ECR
- Database: encrypted Multi-AZ RDS for PostgreSQL
- Background jobs: `pg-boss` in PostgreSQL
- Object storage: private S3 with SSE-KMS
- Key management: customer-managed AWS KMS keys
- Application secrets: AWS Secrets Manager
- Observability: CloudWatch, CloudTrail, and OpenTelemetry
- Infrastructure as code: AWS CDK with TypeScript

Use separate production, non-production, and security/log-archive accounts.

Target a 30-minute RPO and four-hour RTO for complete primary-Region loss. Use
cross-Region automated backup replication and recovery infrastructure defined
in code. Validate the Region pair and achieved objectives before launch.

## Consequences

- The main stateful services, access model, encryption, and monitoring live on
  one controlled platform.
- Cape Town provides an African AWS location with multiple Availability Zones.
- Ghanaian latency and cross-border processing still require validation and
  documentation.
- Multi-AZ protects against an Availability Zone failure but not a Region-wide
  outage.
- Cross-Region backup recovery is asynchronous and cannot guarantee zero data
  loss.
- A single cloud creates concentration risk, mitigated through infrastructure
  as code, portable PostgreSQL data, standard containers, provider adapters,
  backups, and tested exit procedures.
- AWS operational knowledge and cost monitoring become required capabilities.

## Alternatives considered

### Vercel plus an independent managed database

Deferred because it divides runtime, security, observability, networking, and
recovery ownership across providers for a transaction-heavy modular monolith.

### A low-cost platform-as-a-service

Deferred because the production design needs stronger account isolation,
private networking, customer-managed keys, controlled backup replication, and
auditable access.

### Kubernetes

Rejected for the MVP because ECS/Fargate supports the four containerized
deployables without requiring a Kubernetes control plane and operating model.

### Europe as the primary Region

Kept as a fallback only if testing or service availability invalidates Cape
Town. Moving the primary Region requires an ADR and updated privacy assessment.

### Active-active multi-Region

Deferred because the data model relies on strongly coordinated PostgreSQL
transactions and does not justify multi-primary complexity at MVP scale.

## References

- https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReplicateBackups.html
- https://docs.aws.amazon.com/kms/latest/developerguide/kms-cryptography.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html

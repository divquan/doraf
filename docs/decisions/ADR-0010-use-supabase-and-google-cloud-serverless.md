# ADR-0010: Use Supabase and Google Cloud serverless

Status: Accepted
Date: 2026-07-30

## Context

Doraf needs PostgreSQL transactions and constraints but must minimize fixed
infrastructure cost during development and early validation. Its web and API
applications can use request-driven compute, while background operations can
be delivered to request-driven workers.

## Decision

Use Supabase for PostgreSQL only. Supabase Auth, Storage, Functions, and other
Supabase application services are outside this architecture.

Use Google Cloud Run for the two Next.js applications, API, and asynchronous
handlers. Use Cloud Tasks, Pub/Sub, Cloud Scheduler, and Cloud Run Jobs for
durable delivery and scheduled work.

Use private Google Cloud Storage for complaint evidence and generated exports.
Use Google Secret Manager, Cloud KMS, and Cloud Logging for secrets,
application-layer envelope-encryption keys, and runtime observability.

Supabase Free is allowed for development and a closed no-stakes pilot only.
Supabase Pro is the minimum tier before processing meaningful live payments.

Preserve the transactional outbox, but do not use a permanently polling
`pg-boss` worker in this deployment.

## Consequences

- Fixed pilot infrastructure cost can remain near zero.
- The existing containerized Next.js and NestJS applications remain viable.
- PostgreSQL and Prisma business invariants remain unchanged.
- Supabase Free has no automatic backup and can pause; it is prohibited for a
  meaningful live launch.
- Supabase Pro begins at $25 monthly and provides daily backups, not low-RPO
  point-in-time recovery.
- Background handlers remain idempotent because task delivery and provider
  outcomes can repeat.
- The outbox needs a scheduled repair dispatcher in addition to immediate task
  publication after commit.
- Database and Google compute are cross-cloud, so transactional compute must be
  placed and tested near the selected Supabase Region.
- Google Cloud Storage objects require lifecycle, access-control, and recovery
  policies separate from PostgreSQL backups.

## Supersedes

- [ADR-0008](ADR-0008-use-pg-boss-for-mvp-jobs.md) for the selected hosted
  deployment. Its queue reasoning remains a fallback for a long-running
  PostgreSQL-hosted worker.
- [ADR-0009](ADR-0009-use-aws-cape-town-for-mvp-infrastructure.md).

## Alternatives considered

### Full AWS production baseline

Deferred because its Multi-AZ database, load balancers, NAT, and continuously
provisioned containers create a fixed monthly cost inappropriate for the pilot.

### Vercel

Not selected because Doraf is commercial and cannot use Vercel Hobby; the Pro
plan adds a fixed cost while PostgreSQL and durable job design remain separate.

### Cloudflare Workers

Not selected for the primary application runtime because the existing NestJS
API and Node dependencies would require more adaptation. Cloudflare remains a
possible DNS, CDN, or later edge layer.

### Supabase Free for live money movement

Rejected because it can pause and does not include automatic backups.

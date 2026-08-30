# ADR-0005: Use PostgreSQL and Prisma

Status: Accepted  
Date: 2026-07-30

## Context

Dashchecker requires relational constraints, short atomic transactions, concurrency
control, append-only financial records, inventory uniqueness, and reproducible
migrations.

The TypeScript NestJS API benefits from typed database access while still
requiring database-native constraints and transactions.

## Decision

Use PostgreSQL as the canonical transactional database and Prisma for schema
management, migrations, and typed access.

Use PostgreSQL-native migrations or SQL within managed migrations when a
required constraint or index cannot be represented directly by the Prisma
schema.

## Consequences

- Business records and invariants share one transactional source of truth.
- Prisma types improve routine data access.
- Database constraints remain authoritative for uniqueness and integrity.
- Database-specific concurrency behavior requires integration tests against
  PostgreSQL.
- Application code must not treat generated ORM types as public API contracts.

## Alternatives considered

### Document database

Rejected because the core model is relational and requires strong
cross-record integrity.

### In-memory or queue-owned state

Rejected because payment, inventory, and wallet state must survive process and
queue failure.

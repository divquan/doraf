# Decision records

Use decision records for choices that materially constrain product behavior,
architecture, security, money movement, or operations.

## Accepted decisions

- [ADR-0001: Use an append-only wallet ledger](ADR-0001-append-only-wallet-ledger.md)
- [ADR-0002: Retain sold voucher secrets for recovery](ADR-0002-retain-encrypted-sold-vouchers.md)
- [ADR-0003: Restrict the agent balance to earnings](ADR-0003-restrict-agent-balance-to-earnings.md)
- [ADR-0004: Use a modular monolith](ADR-0004-use-a-modular-monolith.md)
- [ADR-0005: Use PostgreSQL and Prisma](ADR-0005-use-postgresql-and-prisma.md)
- [ADR-0006: Use a transactional outbox](ADR-0006-use-a-transactional-outbox.md)
- [ADR-0007: Model one order item per purchased voucher](ADR-0007-model-one-order-item-per-voucher.md)
- [ADR-0008: Use pg-boss for MVP background jobs](ADR-0008-use-pg-boss-for-mvp-jobs.md)
- [ADR-0009: Use AWS Cape Town for MVP infrastructure](ADR-0009-use-aws-cape-town-for-mvp-infrastructure.md)
- [ADR-0010: Use Supabase and Google Cloud serverless](ADR-0010-use-supabase-and-google-cloud-serverless.md)
- [ADR-0011: Use passkeys for internal authentication](ADR-0011-use-passkeys-for-internal-authentication.md)
- [ADR-0012: Use an application-held voucher master key](ADR-0012-use-an-application-held-voucher-master-key.md)

## Status values

- Proposed
- Accepted
- Superseded
- Rejected

## Naming

Use `ADR-NNNN-short-title.md` with sequential numbers.

## Template

```md
# ADR-NNNN: Decision title

Status: Proposed
Date: YYYY-MM-DD

## Context

What forces or requirements make a decision necessary?

## Decision

What was decided?

## Consequences

What becomes easier, harder, required, or prohibited?

## Alternatives considered

What credible alternatives were evaluated and why were they not selected?
```

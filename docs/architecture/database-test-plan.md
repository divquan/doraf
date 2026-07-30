# Database invariant and concurrency test plan

Status: Accepted implementation plan  
Last updated: 2026-07-30

Database tests run against real PostgreSQL with production migrations applied.
SQLite and mocked repositories are insufficient for constraint, isolation,
locking, and migration behavior.

## Migration tests

- Apply all migrations to an empty database.
- Apply migrations to a representative prior schema.
- Verify expected constraints and indexes exist.
- Verify Prisma introspection does not silently remove SQL-managed constraints.
- Verify rollback or forward-fix procedure for each pre-production migration.
- Verify seed is repeatable.

## Tenant and authorization data tests

- Two agents cannot share a phone fingerprint.
- One tenant cannot contain two agents.
- An agent-scoped repository cannot return another tenant's records.
- Suspended state cannot create a new attributed order.
- Retired channel identifiers cannot be reassigned.

## Pricing tests

- Reject maximum below base.
- Reject agent retail below effective base or above effective maximum.
- Reject overlapping active policy or override windows.
- Concurrent policy change and order creation uses one complete version.
- Existing order item snapshots remain unchanged.

## Inventory tests

- Reject malformed and duplicate batch rows atomically.
- Preserve PIN leading zeroes.
- Concurrent checkouts cannot reserve the same voucher.
- Partial-quantity reservation rolls back completely.
- Expired release cannot release a consumed reservation.
- Sold, replaced, refunded, and void items cannot return to available.
- Replacement uses the same product and cannot duplicate allocation.

## Payment and fulfillment tests

- Only one non-terminal attempt exists per order.
- No more than three attempts are created.
- Repeated webhook and verification results create one accepted effect.
- Two successful attempts record one accepted and one excess payment.
- Payment mismatch creates no sold allocation or wallet credit.
- Successful internal transaction rolls back all effects on injected failure.
- Outbox intent is present whenever the commercial commit succeeds.
- Late payment allocates a complete fresh quantity or creates an exception.

## Ledger and withdrawal tests

- One sale credit per order.
- One reversal debit per provider reversal.
- One unit profit debit per qualifying refund.
- Duplicate callbacks cannot duplicate entries.
- Concurrent withdrawals cannot hold more than withdrawable funds.
- Negative balance produces zero withdrawable amount.
- Transfer success posts payout and fee once and consumes the hold.
- Failure releases a hold once.
- Post-success reversal appends compensation without deleting debits.

## Delivery and recovery tests

- One standard SMS message per order item.
- One standard optional email per eligible order.
- Retry count cannot exceed policy.
- Unknown accepted provider result does not blindly create another attempt.
- Recovery reference is non-enumerable and response is generic.
- OTP cannot be reused or brute-forced beyond limits.
- Recovery returns only the selected order's vouchers.

## Dispute and refund tests

- Support cannot approve replacement or refund.
- One standard replacement per original voucher.
- Replacement preserves original sold allocation.
- Unit refund amount and agent debit use immutable item snapshots.
- Repeated refund processing does not duplicate provider or wallet effects.

## Append-only tests

The application database role cannot update or delete:

- ledger entries,
- audit events,
- inventory events,
- provider financial events, or
- closed reconciliation facts.

Compensating records remain insertable through authorized commands.

## Concurrency and crash tests

Run repeated parallel scenarios for:

- last-item inventory reservation,
- same-order webhook processing,
- payment verification racing webhook,
- price update racing order creation,
- withdrawal request racing sale reversal,
- transfer webhook racing verification,
- reservation release racing late success, and
- worker death after provider acceptance but before local completion.

Tests assert final business invariants, not a particular thread ordering.

## Reconciliation tests

- Canonical sources reproduce dashboard totals.
- Daily run identifies intentionally injected mismatches.
- Closing a run prevents mutation.
- Late events create adjustment results rather than rewriting closed totals.
- Every test payment, voucher, ledger entry, refund, and withdrawal reconciles.

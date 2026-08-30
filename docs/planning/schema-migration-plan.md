# Initial schema migration plan

Status: Accepted implementation sequence  
Last updated: 2026-07-30

Keep migrations small enough to review but grouped by dependency. Each migration
includes database tests before dependent application features are added.

## Migration 1 — Database foundation

- Required PostgreSQL extensions
- UUID defaults
- common enums
- migration-managed helper functions
- application and migration role groundwork

## Migration 2 — Identity and tenancy

- agent tenants and agents
- phone-change history
- OTP challenges and sessions
- internal users and credentials
- tenant and phone uniqueness

Implementation progress: agent tenancy is present. Internal users, passkey
credentials, one-time enrollment, bounded authentication ceremonies, and the
opaque revocable session boundary are present, with an exactly-one-actor
database constraint. Agent OTP remains to be implemented. Internal passkey
authentication is recorded in ADR-0011.

## Migration 3 — Catalog, pricing, and channels

- products
- versioned default pricing
- per-agent overrides
- agent retail prices
- permanent web channels
- permanent USSD codes
- active-version and non-reassignment constraints

## Migration 4 — Inventory

- batches
- encrypted vouchers and HMAC fingerprints
- inventory events
- reservations and reservation items
- uniqueness, state, and active-reservation constraints

Implementation progress: batches, encrypted vouchers, HMAC fingerprints,
append-only import events, terminal-state protection, and import constraints are
implemented. Reservations and reservation items remain part of the web-sale
slice because they require orders and payment attempts.

## Migration 5 — Orders and payments

- orders and order items
- payment attempts and events
- accepted versus excess payment relation
- refunds
- price, quantity, attempt, and active-attempt constraints

## Migration 6 — Fulfillment and delivery

- voucher allocations
- delivery messages and attempts
- recovery challenges
- current-allocation and standard-message constraints

## Migration 7 — Wallet and withdrawals

- wallet accounts
- append-only ledger entries
- wallet holds
- withdrawals
- transfer recipients, attempts, and events
- source uniqueness and active-hold constraints

## Migration 8 — Disputes

- disputes
- evidence object references
- voucher replacements
- standard replacement and unit-refund constraints

## Migration 9 — Operations

- audit events
- outbox events
- idempotency records
- generated exports
- append-only protections and operational indexes

Implementation progress: the minimal internal-action audit event was brought
forward with the first guarded Administrator workflow. It records the operator,
role snapshot, action, affected record, reason, authentication strength, request
ID, safe metadata, and timestamp, and is append-only at the database layer. The
outbox, idempotency, export, and broader audit slices remain here.

## Migration 10 — Reconciliation

- reconciliation runs and cases
- immutable closed-run protections
- discrepancy and reporting indexes

## Managed job infrastructure

Dashchecker records business intent in `OutboxEvent`. The selected hosted deployment
dispatches minimal Cloud Tasks or Pub/Sub messages containing the outbox ID and
routing metadata.

No `pg-boss` schema is created for the Supabase/Google Cloud deployment.
`pg-boss` remains a documented fallback if Dashchecker later operates a continuously
running PostgreSQL-connected worker.

## Seed

Seed stable product records:

- `BECE`
- `WASSCE`
- `NOVDEC_PRIVATE`

Seed does not invent base or maximum prices. Products remain unavailable for
checkout until an Administrator configures valid pricing and inventory.

Seed is idempotent and uses stable product codes rather than relying on generated
IDs in application logic.

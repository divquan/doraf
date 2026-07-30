# Database constraints and indexes

Status: Accepted implementation plan  
Last updated: 2026-07-30

## Implementation rule

Use Prisma schema declarations where they express the invariant completely.
Use reviewed migration SQL for PostgreSQL check constraints, partial unique
indexes, deferrable behavior, exclusion constraints, triggers, or specialized
locking/index behavior.

Do not replace a database invariant with UI validation alone.

## Core check constraints

### Money

- Monetary amounts that cannot be negative have `CHECK (amount >= 0)`.
- Ledger entries have `CHECK (amount <> 0)`.
- Currency is `GHS` for MVP records.
- Retail unit price equals base unit price plus agent-profit unit amount.
- Order aggregate amounts equal unit amount multiplied by quantity.
- Withdrawal total hold equals net payout plus fee.
- Effective maximum retail price is not below effective base price.

### Orders

- Quantity is between 1 and 5.
- Order item position is between 1 and 5.
- Delivery phone is required.
- Optional email fields are consistently null or populated as one protected
  value set.
- Price expiry is after creation.

Cross-row checks such as item count equaling order quantity are enforced by the
creating transaction and verified continuously; a deferred database trigger may
be added if implementation testing shows it is safe and maintainable.

### Vouchers

- Product matches its batch through transaction validation and relational
  constraints where practical.
- Availability and dispute disposition combinations are valid.
- A sold or terminally disposed item cannot transition to available.
- Ciphertext, key version, fingerprint, and safe mask are present together.

### Time and attempts

- Expiry timestamps are after creation.
- Attempt numbers are positive.
- Payment attempt number is no greater than 3.
- Delivery retry attempt is within the confirmed initial-plus-three limit for
  standard delivery messages.

## Unique constraints and partial indexes

### Identity and channels

- unique agent tenant
- unique agent phone HMAC fingerprint
- unique web channel identifier, including retired records
- unique USSD referral code, including retired records
- unique wallet per agent and currency

### Pricing

- one current agent product price per agent and product
- at most one active default pricing-policy version per product
- at most one active agent override per agent and product

Version windows must not overlap. PostgreSQL exclusion constraints are preferred
when time-range representation makes the rule clear; otherwise use a locked
write transaction plus continuous invariant check.

### Inventory

- unique serial HMAC fingerprint
- unique PIN HMAC fingerprint
- unique reservation and voucher pair
- partial unique index allowing at most one active reservation per voucher
- unique voucher allocation per voucher
- partial unique index allowing one current allocation per order item
- unique inventory event source identity where the source is retryable

### Orders and payments

- unique public order reference
- unique order and item position
- unique order and payment-attempt number
- unique Paystack payment reference
- partial unique index allowing one non-terminal payment attempt per order
- unique accepted payment-attempt relation per order
- unique provider event identity
- unique refund provider reference
- unique standard unit refund entitlement per order item

Multiple payment attempts may reach provider `SUCCESS`; only one is accepted by
the order. Do not add a constraint that prevents recording an excess successful
payment.

### Delivery

- unique stable client reference per provider submission
- unique message and attempt number
- unique standard voucher-SMS message per order item
- unique standard optional-email message per order

Manual resend messages are separate records linked to the original and
Administrator action.

### Ledger and withdrawal

- unique business source identity for every ledger-entry type
- unique sale credit per order
- unique payment-reversal debit per provider reversal
- unique refund-profit debit per refunded order item
- unique payout and fee debit per successful withdrawal
- unique compensation per returned transfer movement
- unique hold per withdrawal
- partial unique index allowing one active hold per withdrawal
- unique Paystack transfer reference
- unique active recipient per agent, registered phone fingerprint, network, and
  provider

### Operations

- unique idempotency scope and key
- unique outbox aggregate/version/event type where one event is expected
- unique reconciliation run type, reporting date, and source cutoff identity
- unique open discrepancy fingerprint to prevent duplicate active cases

## Append-only enforcement

Use PostgreSQL permissions and/or triggers to reject ordinary `UPDATE` and
`DELETE` on:

- `ledger_entry`,
- `audit_event`,
- `inventory_event`,
- `payment_event`,
- `transfer_event`,
- closed reconciliation-run facts, and
- immutable order-item pricing fields.

Corrections append compensating records. Migration and tightly controlled
retention procedures are separate from ordinary application roles.

## Query indexes

### Agent portal

- orders by agent and creation time descending
- orders by agent, product, and period
- ledger entries by wallet and creation time descending
- withdrawals by agent and creation time descending
- notifications by agent and unread/time state

### Checkout and payment

- sales channel identifier lookup
- product availability and active pricing
- voucher by product and `AVAILABLE` state, ordered by batch/acquisition
- active reservation by expiry
- payment attempt by provider reference
- payment attempts requiring verification by state and next check time

### Delivery and jobs

- delivery message by state and scheduled time
- provider attempt by provider reference
- outbox event by state and available time
- outbox event by aggregate
- idempotency record by scope/key

### Administration

- agent by protected phone fingerprint and status
- order by public reference
- inventory by product, state, batch
- disputes by state, age, and assignee
- withdrawals by state, age, and assignee
- audit events by entity/time and actor/time
- reconciliation cases by state, severity, age, and assignee

### Reporting

- orders and items by accepted-payment time
- inventory events by product and time
- ledger entries by type, source, and time
- provider events by state and time
- refunds and transfers by terminal time

Projection tables or materialized views may be introduced after query plans
show a need. They remain rebuildable and non-canonical.

## Concurrency primitives

### Inventory

Use a short transaction with deterministic selection and PostgreSQL row locking,
such as `FOR UPDATE SKIP LOCKED`, to reserve the complete quantity.

Verify the selected count before writing any reservation. Roll back when the
full quantity is unavailable.

### Wallet

Lock the wallet coordination row or use serializable isolation while computing
posted balance minus active holds. Create a hold only when the full amount is
available.

### Payment success

Lock or conditionally update the order, accepted attempt, reservation, and
wallet coordination records in deterministic order. Database uniqueness remains
the final defense against duplicate effects.

### Serializable retries

Use Prisma's `Serializable` isolation selectively for high-contention financial
and inventory transactions. Retry serialization failure or deadlock errors with
a small bounded policy and fresh state reads.

Do not retry arbitrary external provider calls as part of the database
transaction retry.

# Transaction integrity and asynchronous work

Status: Accepted direction  
Last updated: 2026-07-30

## Source of truth

PostgreSQL is the source of truth for:

- orders and price snapshots,
- payment and transfer attempts,
- inventory items and reservations,
- wallet ledger entries and holds,
- delivery work,
- disputes and refunds,
- audit records, and
- reconciliation runs.

A queue, cache, search index, analytics system, or provider dashboard is never
the canonical Dashchecker record.

## Short transactions

Database transactions remain short. Dashchecker never holds a transaction open while
waiting for:

- buyer Mobile Money authorization,
- Paystack API or webhook delivery,
- SMS or email provider response,
- USSD session input,
- Administrator approval, or
- a background retry timer.

Long-lived business commitments are persisted as states and holds.

## Critical atomic transitions

### Inventory reservation

Reserve the complete same-product quantity or reserve nothing.

### Successful payment

One database transaction:

1. accepts the provider success once,
2. marks the order paid,
3. converts complete reservation to sold,
4. appends one agent sale-profit credit,
5. writes durable delivery work, and
6. writes required audit/outbox records.

### Withdrawal request

Create the request and complete payout-plus-fee hold atomically.

### Transfer success

Append payout and fee debits and release the hold atomically.

### Replacement

Preserve the original item, allocate and sell a same-product replacement, link
the records, and create delivery work atomically.

### Partial refund

Create the unit refund record and unique unit profit-reversal effect under an
idempotent orchestration. External provider completion remains asynchronous.

## Transactional outbox

When a committed domain transition requires asynchronous work, the same
database transaction writes an outbox record.

The worker:

1. claims an outbox record safely,
2. dispatches or performs the job,
3. records outcome and provider reference,
4. marks completion idempotently, and
5. retries under the owning policy when necessary.

The outbox prevents a successful database commit from losing required delivery,
notification, verification, or reconciliation work.

It does not guarantee an external provider executes exactly once. Provider
calls still require stable references, status reconciliation, and idempotent
result processing.

## Idempotency

Every externally repeated action has a stable source identity, including:

- Paystack payment reference,
- Paystack refund reference,
- provider reversal identity,
- Paystack transfer reference,
- USSD provider session/request identity,
- delivery item and attempt identity,
- wallet-entry business source,
- Administrator command identity where retryable, and
- reconciliation run and case identity.

Database uniqueness constraints reject duplicate financial or inventory
effects.

## Concurrency

- Conditional state transitions confirm the expected prior state.
- Inventory selection and reservation use locking or an equivalent atomic
  database technique.
- Multi-item reservations follow a deterministic ordering.
- Only one active payment attempt exists per order.
- Only unheld withdrawable funds can support a new withdrawal.
- Provider callbacks may arrive concurrently and out of order.
- Tests must exercise races, retries, rollback, and process crashes.

## Queue guarantees

Assume at-least-once job delivery. Jobs must be safe to retry.

Queue messages contain identifiers, versions, and minimal routing data—not raw
voucher values or unnecessary personal data. Workers reload current canonical
state and recheck eligibility before acting.

The specific durable queue technology remains open.

## External calls

Do not make an irreversible external call inside a database transaction.

When an external result is ambiguous:

- retain the internal business state appropriate to the risk,
- query or reconcile using the stable provider reference,
- avoid creating a new provider action prematurely, and
- expose the unresolved state operationally.

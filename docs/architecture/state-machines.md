# Domain state machines

Status: Accepted direction  
Last updated: 2026-07-30

Provider-specific statuses are translated into these normalized Doraf states.
Every transition validates its expected prior state and records required event
history.

## Principle: separate state dimensions

Do not compress payment, inventory, fulfillment, delivery, refund, and dispute
status into one order enum.

An order may simultaneously be:

- paid,
- fully allocated,
- awaiting one SMS delivery receipt,
- successfully delivered by email, and
- under dispute for one item.

Agent-facing and administration statuses are projections over these facts.

## Agent account

```text
ACTIVE -> SUSPENDED
SUSPENDED -> ACTIVE
```

Suspension blocks new sales and makes the portal read-only. Historical paid
orders and recovery remain operable.

## Product availability

```text
ACTIVE <-> UNAVAILABLE
```

Unavailable prevents new checkout for that product without changing existing
orders or inventory.

## Voucher availability

```text
AVAILABLE -> RESERVED -> SOLD
RESERVED -> AVAILABLE
AVAILABLE -> QUARANTINED -> AVAILABLE
AVAILABLE -> QUARANTINED -> VOID
AVAILABLE -> VOID
```

`SOLD` never transitions to `AVAILABLE`.

Replacement and refund are terminal dispute dispositions on a sold voucher:

```text
NONE -> REPLACED
NONE -> REFUNDED
```

They do not change the rule that the item remains unavailable.

## Inventory reservation

```text
ACTIVE -> CONSUMED
ACTIVE -> RELEASED
```

Consumed means the complete reserved set became sold. Released means every
still-reserved item became available. Both are terminal.

## Order payment dimension

```text
UNPAID -> PAID
PAID -> PARTIALLY_REFUNDED
PAID -> FULLY_REFUNDED
PARTIALLY_REFUNDED -> FULLY_REFUNDED
```

Provider payment reversal is recorded separately from customer refund status
because it has different operational and ledger meaning.

## Order fulfillment dimension

```text
PENDING -> COMPLETE
PENDING -> EXCEPTION
EXCEPTION -> COMPLETE
EXCEPTION -> REFUNDED
COMPLETE -> PARTIALLY_REPLACED
PARTIALLY_REPLACED -> COMPLETE
```

The item records remain authoritative for partial outcomes.

## Payment attempt

```text
CREATED -> PENDING_AUTHORIZATION
PENDING_AUTHORIZATION -> VERIFYING
PENDING_AUTHORIZATION -> SUCCESS
PENDING_AUTHORIZATION -> FAILED
PENDING_AUTHORIZATION -> ABANDONED
VERIFYING -> SUCCESS
VERIFYING -> FAILED
VERIFYING -> ABANDONED
VERIFYING -> RECONCILING
RECONCILING -> SUCCESS
RECONCILING -> FAILED
RECONCILING -> ABANDONED
```

`SUCCESS`, `FAILED`, and `ABANDONED` are terminal provider outcomes for the
attempt. A successful attempt is additionally classified as accepted or excess
at the order level.

## Refund

```text
REQUESTED -> SUBMITTED
REQUESTED -> CANCELLED
SUBMITTED -> PENDING
SUBMITTED -> SUCCESS
SUBMITTED -> FAILED
PENDING -> SUCCESS
PENDING -> FAILED
FAILED -> SUBMITTED
```

Terminal failure does not permit a new refund record to bypass the original
idempotency identity. An Administrator retries or reconciles the same refund.

## Delivery message

```text
PENDING -> SUBMITTED
PENDING -> FAILED
SUBMITTED -> DELIVERED
SUBMITTED -> FAILED
SUBMITTED -> UNKNOWN
UNKNOWN -> DELIVERED
UNKNOWN -> FAILED
FAILED -> PENDING
```

`FAILED -> PENDING` represents a policy-approved retry until the retry limit.
Each provider submission remains an append-only `DeliveryAttempt`.

Email and each voucher SMS have independent state.

## Wallet hold

```text
ACTIVE -> CONSUMED
ACTIVE -> RELEASED
```

Consumed means successful transfer debits were posted. Released means the funds
are no longer encumbered.

## Withdrawal

```text
REQUESTED -> APPROVED
REQUESTED -> AWAITING_MANUAL_PAYMENT
REQUESTED -> REJECTED
REQUESTED -> CANCELLED
APPROVED -> AWAITING_MERCHANT_OTP
APPROVED -> CANCELLED
AWAITING_MANUAL_PAYMENT -> SUCCESS
AWAITING_MANUAL_PAYMENT -> CANCELLED
AWAITING_MERCHANT_OTP -> SUBMITTED
AWAITING_MERCHANT_OTP -> CANCELLED
SUBMITTED -> PENDING
SUBMITTED -> SUCCESS
SUBMITTED -> FAILED
SUBMITTED -> REVERSED
PENDING -> SUCCESS
PENDING -> FAILED
PENDING -> REVERSED
SUCCESS -> REVERSED
```

`REQUESTED -> APPROVED` records a Paystack payout; `REQUESTED ->
AWAITING_MANUAL_PAYMENT` records a manual payout whose payment an Administrator
confirms later. A manual confirmation (`AWAITING_MANUAL_PAYMENT -> SUCCESS`)
posts the same ledger debits and consumes the hold as a Paystack success, but it
is terminal: manual reversals are not yet supported.

A reversal after success appends compensating ledger entries; it never deletes
payout and fee debits.

## Dispute

```text
OPEN -> UNDER_REVIEW
UNDER_REVIEW -> REPLACEMENT_APPROVED
UNDER_REVIEW -> REFUND_APPROVED
UNDER_REVIEW -> REJECTED
UNDER_REVIEW -> UNRESOLVED
REPLACEMENT_APPROVED -> RESOLVED
REFUND_APPROVED -> RESOLVED
UNRESOLVED -> UNDER_REVIEW
```

An exceptional goodwill decision records its own resolution reason and effects.

## Reconciliation run

```text
CREATED -> RUNNING
RUNNING -> REVIEW_REQUIRED
RUNNING -> READY_TO_CLOSE
RUNNING -> FAILED
REVIEW_REQUIRED -> READY_TO_CLOSE
READY_TO_CLOSE -> CLOSED
```

`CLOSED` is immutable. Late events appear in an adjustment run or linked
reconciliation case.

## Reconciliation case

```text
OPEN -> ASSIGNED
ASSIGNED -> INVESTIGATING
INVESTIGATING -> ACTION_PENDING
INVESTIGATING -> RESOLVED
ACTION_PENDING -> RESOLVED
RESOLVED -> REOPENED
REOPENED -> ASSIGNED
```

Reopening preserves prior resolution history.

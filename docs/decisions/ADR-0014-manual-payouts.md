# ADR-0014: Administrator-confirmed manual payouts

Status: Accepted
Date: 2026-08-08

## Context

Every approved withdrawal currently goes to Paystack for Mobile Money transfer
initiation, finalization, webhook settlement, and reconciliation. Some payouts
need to be paid out of band (for example by the Administrator sending Mobile
Money directly, or settling cash), with Doraf recording that the payment
happened after the fact.

The product owner confirmed:

- the payout method is chosen per withdrawal at approval time,
- the GHS 1 fee still applies to manual payouts,
- a confirmed manual payout posts the same ledger debits and consumes the hold
  exactly like a Paystack success,
- marking a manual payout paid requires a transaction reference and an exact
  amount confirmation, and
- manual payout reversals are deferred to a later change; a confirmed manual
  payout is terminal.

## Decision

Withdrawals carry a `payout_method` of `PAYSTACK` or `MANUAL`. Approving with
`MANUAL` moves the withdrawal to a new `AWAITING_MANUAL_PAYMENT` state instead of
`APPROVED`, keeps the wallet hold active, and does not queue the Paystack
submission outbox event.

An Administrator confirms the manual payout through a dedicated action that is
serializable and idempotent:

- requires the state to be `AWAITING_MANUAL_PAYMENT` with an active hold,
- requires the typed net amount to match the approved snapshot exactly,
- records the transaction reference and actor,
- appends the `PAYOUT_DEBIT` and `PAYOUT_FEE_DEBIT` ledger entries (unique on
  wallet, source type, and source id, so duplicates are skipped),
- consumes the hold,
- moves the withdrawal to `SUCCESS`, and
- writes a `WITHDRAWAL_MANUAL_PAID` audit event.

An Administrator can also cancel an `AWAITING_MANUAL_PAYMENT` withdrawal, which
releases the hold and writes a `WITHDRAWAL_CANCELLED` audit event. Both actions
retry PostgreSQL serializable conflicts and return the existing state when the
action already completed, so a retry or double click cannot double-pay.

Manual payouts have no transfer attempt and are never picked up by Paystack
reconciliation.

## Consequences

- The wallet ledger stays identical whether a payout is Paystack or manual.
- Agents see `SUCCESS` with no visible distinction of payout method.
- The Paystack submission worker, merchant OTP flow, and reconciliation remain
  Paystack-only.
- Manual payout reversal (compensating credits when funds bounce back) is not yet
  implemented; a confirmed manual payout is terminal.
- The hold on a manually approved payout remains active indefinitely until an
  Administrator either confirms or cancels it.

## Alternatives considered

- Reusing `APPROVED` with a method flag: the explicit state makes the pending
  manual action visible to both Administrator and agent and prevents the Paystack
  outbox worker from acting on it.
- A separate "Paid manually" terminal state: rejected because the product owner
  chose identical wallet semantics and agent visibility to a Paystack success.
- A second Administrator to confirm payment: rejected for MVP speed; the
  reference plus exact-amount confirmation plus immutable audit trail were deemed
  sufficient for now.

# ADR-0001: Use an append-only wallet ledger

Status: Accepted  
Date: 2026-07-30

## Context

Doraf credits agent profit after a paid order, debits profit when a customer
payment reverses, holds funds during withdrawal approval, and records final
withdrawal payouts and fees.

Callbacks and jobs may be delivered more than once. Payment reversals may arrive
after an agent withdraws, so a wallet may legitimately have a negative balance.
Directly editing a stored balance would destroy the history needed to explain
and reconcile these events.

## Decision

Use an append-only ledger for posted wallet money movements. Derive the wallet
balance from ledger entries rather than allowing operators to edit it.

Represent pending withdrawal commitments as explicit holds. Calculate:

`withdrawable = max(0, ledger balance - active holds)`

Posted entries include at least:

- sale profit credit,
- sale-payment reversal debit,
- withdrawal payout debit,
- withdrawal fee debit, and
- compensating credits for returned withdrawal funds.

Every entry is linked to its business source and protected by an idempotency or
uniqueness constraint appropriate to that source.

Correct mistakes by appending compensating entries. Do not edit or delete posted
entries through ordinary product or administration workflows.

Allow ledger balance to become negative. A negative balance prevents withdrawal
but does not automatically prevent new sales.

## Consequences

- Wallet history remains explainable and auditable.
- Repeated webhooks cannot legitimately create repeated money movement.
- Balances can be reconstructed and reconciled.
- Implementations must distinguish posted balance from held and withdrawable
  amounts.
- Corrections require compensating entries rather than mutable balance fields.
- Reporting must account for negative agent balances as platform receivables or
  debt under the applicable accounting policy.

## Alternatives considered

### Mutable balance field

Rejected because it cannot explain historical changes reliably and makes
concurrent callbacks and manual corrections dangerous.

### Prevent negative balances

Rejected because a payment can reverse after funds have already been paid out.
Forcing the balance to zero would hide the amount owed.

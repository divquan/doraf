# ADR-0003: Restrict the agent balance to earnings

Status: Accepted  
Date: 2026-07-30

## Context

Doraf owes agents profit from attributed voucher sales and pays those earnings
to a registered Mobile Money number. A general-purpose wallet would add product,
fraud, accounting, and potentially regulatory complexity unrelated to the core
reseller proposition.

## Decision

Treat the agent wallet as an earnings ledger and payout interface only.

Do not permit:

- top-ups,
- buyer deposits,
- peer-to-peer or agent-to-agent transfer,
- internal purchase or spending,
- interest,
- cash-in or cash-out behavior other than confirmed earnings payout, or
- payout to a third-party destination.

Withdraw only to the agent's registered Ghana Mobile Money number under the
confirmed OTP, hold, Administrator approval, provider, and ledger rules.

Continue to use the append-only ledger and allow negative balances for
post-payout payment reversals.

## Consequences

- The balance directly represents earnings, adjustments, and payout activity.
- Reconciliation and agent explanations remain narrower.
- Doraf cannot use the balance as a consumer wallet or payment instrument.
- Agents cannot fund or transfer value through Doraf.
- Product expansion into spending, top-up, or third-party transfer requires a
  new regulatory review and superseding decision.
- Qualified advice is still required to determine Doraf's actual regulatory
  classification.

## Alternatives considered

### General-purpose stored-value wallet

Rejected for the MVP because it is not needed for voucher resale and materially
expands regulatory, fraud, security, and accounting scope.

# Reporting and reconciliation

Status: Confirmed product policy  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- canonical metric definitions,
- reporting-period boundaries,
- aggregate reporting projections,
- continuous integrity checks,
- daily reconciliation runs,
- discrepancy cases, and
- finance and operations exports.

It does not own or mutate the source commercial records it reconciles.

## Time

Persist timestamps in UTC. Product reporting uses the IANA timezone
`Africa/Accra`.

Agent-facing periods are:

- **Today** — current Accra calendar day
- **7 days** — today plus the previous six Accra calendar days
- **30 days** — today plus the previous twenty-nine Accra calendar days
- **Lifetime** — all recorded activity

Reports state their timezone and inclusive boundaries. The exact daily-close
execution time remains an operational choice.

## Canonical sales metrics

### Gross sales value

Sum of immutable retail-total snapshots for successfully paid and fulfilled
orders before refunds.

Do not include:

- failed or abandoned payments,
- unmatched provider payments,
- duplicate or excess payments, or
- test-mode activity.

### Net sales value

`gross sales value - completed customer refunds`

Report post-sale payment reversals separately so users can distinguish customer
refunds from provider reversals.

### Voucher units sold

Count of voucher items converted to sold for successfully paid orders. Report by
checker product, agent, channel, and period where authorized.

### Agent earnings

`sale-profit credits - payment-reversal debits - refund-reversal debits`

Replacement vouchers do not create another agent earning or reversal.

## Wallet reporting

Report separately:

- total positive agent ledger balances as platform agent liability,
- active withdrawal holds,
- total withdrawable amount,
- total negative balances as agent debt,
- sale-profit credits,
- reversal debits,
- withdrawal payout and fee debits, and
- compensating credits.

Do not offset negative agent wallets against positive agent liabilities in the
headline liability metric.

## Doraf commercial reporting

### Gross base-price revenue

Sum of immutable base-price snapshots for sold voucher units.

Report refunds and payment-reversed sales separately and derive net base-price
revenue for financial analysis.

### Realized contribution

For the relevant sold units:

`net base-price revenue`

minus:

- acquisition cost of the actually allocated voucher items,
- actual payment-provider fees,
- actual SMS and email costs,
- actual withdrawal costs borne by Doraf, if any, and
- other directly attributable provider costs.

The accounting treatment of taxes and the point of formal revenue recognition
require qualified accounting advice.

## Inventory reconciliation

Reconcile item-level transitions to batch and product totals.

For each product and period, account for:

- opening state counts,
- imported items,
- new reservations,
- released reservations,
- sold allocations,
- replacement allocations,
- quarantine and release,
- void dispositions,
- refund or replacement dispositions, and
- closing state counts.

No report may count a replacement voucher as a new buyer sale or agent earning.

## Payment reconciliation

Match:

- every Paystack successful charge to one payment attempt,
- every accepted payment attempt to one order,
- expected and provider reference, amount, and currency,
- order-paid state to complete sold allocation,
- one sale-profit credit per fulfilled order,
- excess payments to refunds,
- customer refunds to provider refund status,
- provider payment reversals to wallet reversal debits, and
- Paystack fees and settlements to the corresponding transaction population.

## Withdrawal reconciliation

Match:

- withdrawal requests to holds,
- approvals and rejections to Administrator audit records,
- Paystack recipients and unique transfer references,
- provider pending and terminal states,
- successful transfers to payout and fee debits,
- failed or reversed transfers to released holds or compensating credits, and
- aggregate transfer value and fees to Paystack balance and settlement records.

## Delivery-cost reconciliation

Match SMS and email provider submissions and accepted billable events to:

- delivery items,
- attempts,
- product and order,
- channel,
- retry reason, and
- invoiced cost.

Unknown provider outcomes remain visible rather than being treated as confirmed
delivery.

## Continuous checks

Continuously detect at least:

- paid order without complete sold allocation,
- sold allocation without accepted payment,
- paid order without one sale-profit credit,
- duplicate credit or reversal source,
- expired reservation still blocking inventory,
- excess payment without refund workflow,
- transfer terminal state without corresponding wallet effect,
- negative withdrawable amount,
- delivery work missing for a paid order, and
- inventory or ledger invariant violations.

## Daily reconciliation run

A formal daily run records:

- reporting date and timezone,
- source cut-off timestamps,
- source-record versions or query fingerprints,
- totals by reconciliation category,
- matched and unmatched counts and value,
- generated discrepancy cases,
- run status,
- operator review, and
- completion timestamp.

Closed run inputs and results are immutable. Late events are included in a
subsequent adjustment run or discrepancy resolution rather than silently
rewriting a closed run.

## Discrepancy cases

Each discrepancy becomes an assignable case containing:

- category and severity,
- source records and evidence,
- amount or inventory impact,
- responsible operator,
- status and age,
- investigation notes,
- approved resolution action, and
- links to compensating or corrective domain records.

Cases never provide a generic edit operation. Resolution uses the owning
domain's command, such as refund, replacement, reversal, hold release, or
audited inventory disposition.

## Exports

Provide daily, filterable exports for:

- finance and provider settlement,
- inventory movement and closing state,
- wallet liabilities and negative balances,
- withdrawals and transfer reconciliation,
- refunds and reversals,
- delivery-provider cost, and
- unresolved discrepancies.

Exports inherit administration authorization, privacy masking, expiry, and
audit requirements.

## Shared projections

Agent portal totals, administration dashboards, and exports derive from the
same canonical source records and metric definitions. Cached projections may be
eventually updated, but every displayed result must be traceable and
rebuildable from those sources.

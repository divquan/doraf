# ADR-0007: Model one order item per purchased voucher

Status: Accepted  
Date: 2026-07-30

## Context

An order can contain one to five vouchers of one product. Each voucher has its
own serial-number/PIN pair, allocation, numbered SMS, delivery history, dispute,
replacement, and possible partial refund.

Storing only an order quantity would force these item-level outcomes into
arrays or ambiguous counters and make per-unit financial effects harder to
constrain.

## Decision

Create one immutable `OrderItem` for every purchased voucher unit.

Store the unit base price, retail price, and agent profit snapshot on each item.
Link voucher allocations, voucher SMS delivery, disputes, replacements, and
unit refunds to the relevant item.

The parent order retains aggregate snapshots and must reconcile to its complete
item set.

## Consequences

- Multi-voucher allocation is explicit.
- SMS numbering and partial delivery are traceable.
- Replacement preserves original allocation history.
- A partial refund can use the exact unit price and profit.
- Order item count and aggregate totals require database and application
  invariants.
- The maximum of five keeps per-order item creation small.

## Alternatives considered

### Store only quantity on the order

Rejected because allocation, delivery, replacement, and refund outcomes occur
per voucher.

### Store voucher arrays in one order row

Rejected because relational constraints, item-level history, and secure access
would be weaker and harder to query.

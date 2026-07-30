# Business model

Status: Discovery  
Last updated: 2026-07-30

## Revenue model

Doraf centrally acquires WAEC PIN inventory and defines a base price for each
PIN product. The base price is intended to cover:

- inventory acquisition cost,
- payment and delivery operating costs, and
- Doraf's platform margin.

Agents choose a higher buyer-facing retail price and earn the difference
between that retail price and the effective base price.

The internal allocation of the base price among cost, fees, and platform margin
is not buyer- or agent-configurable. Whether those components need separate
accounting fields remains an accounting-design question.

## Price hierarchy

Each PIN product has:

- a default base price, and
- a default maximum retail price.

An agent can optionally have:

- an agent-specific base-price override, and
- an agent-specific maximum-retail-price override.

For each value, the agent-specific override takes precedence over the product
default. This produces the agent's effective pricing policy.

Only an Administrator can create, change, or remove an override. The Support
role can inspect effective pricing and its source but cannot change it.

## Agent price

An agent selects one active retail price per PIN product. The same price applies
to that agent's web and USSD channels.

The selected retail price must satisfy:

`effective base price <= retail price <= effective maximum retail price`

Prices are denominated in Ghana cedis and have two-decimal precision. Software
must store and calculate them in integer pesewas.

## Agent profit

For an order:

`agent profit = retail price snapshot - base price snapshot`

The platform does not subtract payment-processing, SMS, or other operating fees
from the agent profit after the sale. Those costs are accounted for within the
base price.

## Buyer price

The buyer sees one final price before initiating payment. No payment-processing,
SMS, or platform surcharge is added later in checkout.

## Price snapshots

When an order is created, it stores at least:

- currency,
- effective base price,
- retail price,
- calculated agent profit,
- applicable product,
- agent, and
- the pricing-policy or override identifiers used to calculate the values.

These values are immutable commercial snapshots. Later pricing changes affect
only newly created orders.

## Applying policy changes

When a product default or agent-specific override changes:

- Existing orders retain their original price snapshots.
- An agent price below the new effective base price is automatically moved up
  to the effective base price.
- An agent price above the new effective maximum is automatically moved down to
  the effective maximum.
- A policy with an effective maximum below its effective base is rejected.
- The Administrator's action and any automatic adjustment are audited.

The notification sent to an affected agent, if any, remains to be defined.

## Questions deferred to accounting and operations

- Whether inventory acquisition cost is tracked per batch or as a product
  standard cost
- Whether Doraf's realized margin is calculated from standard or batch cost
- Tax treatment and required invoice or receipt breakdown
- How refunds, reversals, discounts, and promotions affect agent profit
- Whether agent-specific overrides can have effective dates or scheduled expiry

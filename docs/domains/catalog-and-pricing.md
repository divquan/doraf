# Catalog and pricing

Status: Discovery  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- the PIN product catalog,
- default product pricing policies,
- agent-specific pricing overrides,
- agent-selected retail prices,
- pricing validation, and
- immutable order-price calculation.

It does not own payment collection, the wallet ledger, or physical PIN
allocation.

## MVP products

The catalog contains:

- BECE Checker,
- WASSCE Checker, and
- NOV/DEC (Private) Checker.

Each has an independent pricing policy and inventory pool. Examination year is
not a separate product variant because each checker supports all applicable
years.

## Pricing resolution

For an agent and product:

1. Read the product's default base price and retail maximum.
2. Replace either value with its agent-specific override when one exists.
3. Confirm the resulting maximum is not below the resulting base price.
4. Validate or clamp the agent's active retail price within that range.
5. Snapshot the effective values when creating an order.

## Required invariants

- All monetary values use the same currency for a given order.
- MVP prices are in GHS and stored in integer pesewas.
- An active retail price cannot be below the effective base price.
- An active retail price cannot exceed the effective retail maximum.
- An effective retail maximum cannot be below the effective base price.
- One agent has at most one active retail price for a product.
- An order's pricing snapshot cannot be modified after creation.
- Agent profit equals retail price minus effective base price.
- Agent profit cannot be negative.

## Authorization

- Administrators manage product defaults and agent-specific overrides.
- Agents manage their own retail prices within their effective range.
- Support has read-only access to defaults, overrides, effective prices, and
  order snapshots.
- Buyers can see the final retail price but not internal costs, base prices,
  margins, or override details.

## Audit requirements

Audit:

- product default changes,
- creation, modification, and removal of agent overrides,
- the reason supplied by the Administrator,
- automatic changes to an agent's active retail price, and
- the pricing inputs and result used for each order.

## Concurrency

Order creation must calculate and persist its price snapshot consistently. A
concurrent pricing-policy update must result in the order using either the
complete old policy or the complete new policy, never a mixture.

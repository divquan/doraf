# API modules and ownership

Status: Accepted direction  
Last updated: 2026-07-30

The NestJS API is organized by business capability rather than by generic
controller, service, or database folders.

## Identity

Owns agent OTP authentication, internal authentication integration, sessions,
account recovery coordination, and actor identity.

## Agents and sales channels

Owns agent tenant profile, account status, permanent web identifiers, permanent
USSD referral codes, and immutable channel attribution resolution.

## Catalog and pricing

Owns checker products, product availability, default pricing policies,
per-agent overrides, agent retail prices, and order-price calculation.

## Inventory

Owns batches, encrypted voucher pairs, duplicate fingerprints, item states,
reservations, sale allocation, quarantine, replacement linkage, and inventory
invariants.

## Orders

Owns durable order identity, agent/channel attribution, buyer delivery and payer
snapshots, product quantity, price snapshots, and commercial order state.

## Payments

Owns Paystack charge attempts, references, webhooks, verification, late and
duplicate payment handling, refunds, and provider payment reversals.

## Fulfillment

Coordinates the successful-payment transaction across order, inventory, wallet,
and durable delivery work. It does not make external notification calls inside
the transaction.

## Delivery

Owns SMS and email delivery items, provider attempts, retries, reconciliation,
message composition, recovery OTP, and Administrator resend.

## Wallet and ledger

Owns immutable agent entries, active holds, balance calculation, negative
balances, source uniqueness, and compensating movements.

## Withdrawals

Owns withdrawal requests, holds, Administrator decisions, Paystack recipients
and transfers, merchant OTP progression, provider status, and terminal wallet
effects.

## Disputes, replacements, and refunds

Owns complaint intake, evidence references, Administrator decisions,
replacement coordination, partial refunds, and related wallet effects.

## Reporting and reconciliation

Owns canonical metric definitions, projections, continuous checks, immutable
daily runs, discrepancy cases, and privacy-safe exports.

## Administration and audit

Owns internal authorization policies, sensitive-action audit records, queue
views, step-up actions, and safe cross-domain investigation queries.

## Module interaction rules

- A module owns writes to its source records.
- Cross-module behavior uses explicit application commands or services.
- Direct mutation of another module's records is prohibited.
- Cross-module reads use explicit query interfaces or purpose-built projections.
- Domain invariants are enforced inside the owning module and database.
- Provider payload types do not become domain entities.
- Transaction orchestration may span modules where the confirmed business
  invariant requires one commit.
- Module boundaries must remain testable even though deployment is shared.

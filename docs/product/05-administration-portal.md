# Administration portal

Status: Confirmed MVP scope  
Last updated: 2026-07-30

## Purpose

The administration portal gives authorized internal operators structured tools
to operate and investigate Doraf. It is not a general-purpose database editor.

The portal enforces the two confirmed internal roles:

- Administrator
- Support

## Operational dashboard

The dashboard summarizes:

- successful sales and collected value,
- vouchers fulfilled by checker product,
- agent-profit credits and current liability,
- negative agent wallets,
- withdrawal volume and status,
- refunds and replacements,
- payment and fulfillment exceptions,
- SMS and email delivery failures,
- open disputes, and
- inventory availability and low-stock alerts.

Metric definitions, `Africa/Accra` reporting periods, and reconciliation
sources follow the reporting and reconciliation domain.

## Inventory

Administrators see exact counts by product and state, including:

- available,
- reserved,
- sold,
- quarantined,
- disputed or replaced, and
- refunded dispositions.

They can configure low-stock thresholds for each checker product.

### Batch import

The import workflow:

1. Selects one checker product.
2. Supplies vendor, invoice/reference, acquisition date, and unit cost.
3. Uploads a CSV containing serial-number/PIN pairs.
4. Validates the whole file without creating inventory.
5. Shows counts and row-level errors.
6. Requires explicit Administrator confirmation.
7. Commits the valid complete batch or commits nothing.
8. Records uploader, timestamps, and batch audit history.

The MVP does not require second-person approval for inventory import.

### Batch history

Administrators can inspect:

- source and commercial metadata,
- original and accepted row counts,
- import status,
- state counts,
- related disputes and quarantine actions,
- uploader, and
- audit history.

Bulk export of raw serial-number/PIN pairs is not available.

## Products and pricing

Administrators manage:

- product availability,
- default base price,
- default maximum retail price,
- agent-specific base-price overrides,
- agent-specific retail-maximum overrides, and
- related reasons and audit history.

The portal previews effective pricing and automatic changes to an agent's active
retail price before confirmation.

Support can inspect pricing and its source but cannot modify it.

## Agent management

Administrators can:

- search and inspect agents,
- review account and sales-channel status,
- inspect privacy-safe sales and wallet history,
- apply pricing overrides,
- suspend and restore accounts,
- perform documented phone-number recovery,
- review negative balances, and
- decide how pending withdrawals and existing funds are handled during
  suspension.

Support has investigation access but cannot change agent status, ownership,
pricing, or wallet state.

Neither role can impersonate an agent.

## Order investigation

An order view connects:

- agent and channel attribution,
- immutable product and pricing snapshot,
- payment attempts and provider references,
- inventory reservations and sold allocations,
- masked voucher pairs,
- delivery and recovery history,
- wallet entries,
- refunds,
- replacements, and
- disputes.

Support sees masked data and safe errors. Administrators see the same by
default.

### Voucher reveal

An Administrator can reveal an individual raw voucher only after:

1. initiating a fresh step-up confirmation,
2. entering a reason,
3. confirming the specific voucher and order, and
4. creating the sensitive-action audit record.

The step-up authentication mechanism remains to be chosen. Reveal access is
time-limited and does not enable bulk export.

## Work queues

### Payment and fulfillment exceptions

Includes mismatched provider results, late paid orders without inventory,
duplicate payments, and incomplete internal processing.

### Delivery failures

Shows per-voucher and per-channel status. Administrators may trigger an audited
resend only to original destinations.

### Withdrawals

Supports review, approval, rejection, cancellation before initiation, Paystack
recipient and transfer creation, merchant OTP progression, pending
reconciliation, and terminal outcomes.

### Disputes, replacements, and refunds

Supports evidence review, masked investigation, controlled reveal,
same-product replacement, partial refund, and exceptional goodwill decisions.

### Reconciliation

Shows discrepancies among provider events, orders, inventory, wallet entries,
withdrawals, refunds, and settlements. Automatic discrepancy correction is not
part of the MVP. Cases are assignable, aged, evidence-backed, and resolved
through audited domain actions.

## Support workspace

Support can:

- search agents and orders,
- inspect masked operational history,
- inspect safe payment and delivery errors,
- record complaints,
- upload complaint evidence, and
- prepare an escalation for Administrator review.

Support cannot:

- expose voucher values,
- move or edit inventory,
- create or approve money movement,
- trigger delivery,
- make dispute decisions,
- change pricing,
- suspend an agent,
- recover an account,
- edit system configuration, or
- impersonate an agent.

## Audit explorer

Authorized Administrators can search audit history by:

- operator,
- role at the time,
- action,
- reason,
- entity type and identifier, and
- timestamp.

Audit records are not editable through the portal. Sensitive before-and-after
values remain masked.

## Exports

The portal provides purpose-specific, privacy-safe exports for:

- finance and reconciliation,
- aggregate and item-state inventory,
- orders and payments,
- wallet liabilities,
- withdrawals,
- refunds and replacements, and
- disputes.

Each export has an explicit schema and authorization rule. Exports are audited,
expire when delivered through a download mechanism, and exclude raw voucher
secrets unless a future separately approved workflow requires them.

## Explicitly prohibited

- Raw SQL or arbitrary database queries
- Direct balance editing
- Arbitrary ledger-entry forms
- Bulk raw-voucher export
- Agent impersonation
- Silent record mutation
- Editing or deleting audit records
- Reassigning retired agent codes

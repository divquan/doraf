# Inventory and vouchers

Status: Discovery  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- centrally sourced voucher batches,
- the serial-number/PIN pair for each voucher,
- product classification,
- inventory availability and reservation,
- allocation of vouchers to paid orders, and
- the audit trail for inventory movement and sensitive access.

It does not own post-sale usage on WAEC systems. Doraf cannot currently observe
whether a buyer has used a voucher zero, one, two, or three times.

## Inventory item

Each item belongs to exactly one checker product and contains:

- an alphanumeric serial number, and
- a PIN stored as a 12-character numeric string.

The PIN must never be parsed or stored as a numeric type because leading zeroes
are significant.

The serial number and PIN are an inseparable pair. Allocation, delivery, and
recovery must operate on the pair rather than either value independently.

## Inventory lifecycle

The inventory states are:

- `AVAILABLE` — eligible for a new order
- `RESERVED` — temporarily assigned to an in-progress order
- `SOLD` — irrevocably assigned to a successfully paid order
- `QUARANTINED` — withheld because validity or data quality is uncertain
- `VOID` — permanently excluded from sale

A sold voucher never returns to available inventory merely because SMS or email
delivery failed. Delivery failure does not prove that the secret was not
exposed.

A sold voucher may later receive a dispute disposition such as `REPLACED` or
`REFUNDED`. This records the commercial resolution without making the original
item available again.

## Inventory-entry requirements

The MVP inventory unit is a manually entered batch associated with one checker
product and source. An Administrator adds one or more serial-number/PIN pairs in
a structured form. The batch records:

- vendor,
- vendor invoice or reference,
- acquisition date,
- unit acquisition cost,
- uploader, and
- import timestamp.

Validation should reject:

- a missing value,
- a PIN that is not exactly 12 digits,
- a malformed serial number,
- duplicate serial numbers,
- duplicate PINs,
- a pair already known to Doraf, or
- a row whose product is ambiguous.

The entire batch is validated before inventory is created. Any invalid or
duplicate entry rejects the whole batch. The form returns entry-level error
details so the Administrator can correct and retry the data.

### Implemented entry contract

The administration client sends structured `serialNumber` and `pin` entries.
Preview validates the complete set and checks keyed fingerprints against
existing inventory. Commit repeats validation so a stale or modified preview
cannot bypass it. CSV upload is outside the MVP.

Only successfully committed batches are stored in `InventoryBatch`; therefore
the presence of a batch means the import completed. A failed preview creates no
batch or vouchers. Authenticated commit attempts are audited without treating a
rejected batch as inventory.

Administrator and Support inventory views derive product totals from voucher
state, rather than from a separately maintained counter. Recent batch history
and batch detail expose masked serial numbers and PINs only. Ciphertext,
fingerprints, wrapped data keys, and key versions remain outside the inventory
read model.

Commit creates the batch, all encrypted vouchers, and one append-only import
event per voucher in a single serializable transaction. Database uniqueness is
the final defense if another import commits the same serial or PIN after
preview.

## Security requirements

Voucher secrets are the platform's primary inventory asset. The implementation
should:

- encrypt serial numbers and PINs at rest,
- use non-reversible fingerprints to detect duplicate values,
- mask values in logs, analytics, and ordinary support views,
- restrict raw-value access to narrow fulfillment and audited Administrator
  workflows,
- never include raw values in URLs,
- avoid exposing available inventory through agent-facing interfaces, and
- record every manual reveal or export.

Voucher values use AES-256-GCM with unique nonces and authenticated record
context. A random data key is created per batch and wrapped by the
application-held voucher master key under ADR-0012. Duplicate detection uses
purpose-separated keyed HMAC-SHA-256 fingerprints; fingerprint and encryption
keys remain separate. Plaintext data keys are wiped from the importer after
use.

## Required invariants

- An inventory item belongs to exactly one checker product.
- A serial number/PIN pair is allocated to at most one order.
- An order line receives exactly the quantity of vouchers it purchased.
- Only available inventory can be reserved.
- Only the reserving order can convert its reservation to sold.
- Sold inventory cannot become available again through an ordinary operator
  action.
- Product counts can be reconciled from item-level state transitions.

## Inventory selection

Unused vouchers do not expire by date, so first-in-first-out allocation is the
proposed default for predictable operations. Batch priority and quarantine
rules may override it.

An order must never receive a voucher for a different checker product, even
when another product has available inventory.

## Reservation policy

An order contains one to five vouchers of one checker product. Immediately
before Doraf initiates Paystack payment, it reserves the order's complete
quantity atomically. If the complete quantity is unavailable, no voucher is
reserved and payment is not initiated.

The reservation covers Paystack's documented 180-second Mobile Money
authorization window. At the end of that window:

1. If a success webhook was processed, convert all reserved items to `SOLD`.
2. If success was not received, query Paystack's verification endpoint.
3. If Paystack reports success, convert the items to `SOLD`.
4. If Paystack reports a terminal failure or abandonment, release the items to
   `AVAILABLE`.
5. If Paystack remains non-terminal, retain the items for a five-minute grace
   period and retry verification.
6. After the grace period, release the items while continuing background
   payment reconciliation.

Reservation state is committed data, not a long-running database lock. Each
reserve, sell, or release transition occurs in a short transaction.

If background reconciliation later finds a successful payment, Doraf atomically
allocates fresh inventory. If the full quantity is unavailable, it does not
partially fulfill; the paid order enters the Administrator exception queue.

## Disputed and replacement inventory

When an Administrator approves a replacement:

- preserve the original sold item,
- mark its dispute disposition `REPLACED`,
- allocate an available item of the same checker product,
- mark the replacement sold,
- link both items, order, and dispute, and
- deliver the replacement only to the order's original destinations.

The original and replacement items never return to available inventory. An
affected item refunded because replacement was unavailable is likewise
permanently excluded.

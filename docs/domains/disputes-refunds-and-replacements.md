# Disputes, refunds, and replacements

Status: Confirmed product policy  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- buyer complaint records,
- evidence and investigation history,
- replacement decisions,
- refund decisions,
- links between original and replacement vouchers, and
- coordination with inventory, payments, delivery, and the wallet ledger.

## Complaint intake

Support records:

- order reference,
- affected voucher position,
- complaint category,
- exact buyer-reported error,
- safe contact context,
- optional screenshot, and
- intake timestamp.

Support sees voucher secrets only in masked form and cannot approve or execute a
replacement or refund.

Evidence uploads must be private, access-controlled, malware-checked, and
excluded from analytics. Buyers should be asked to redact unrelated student
information where possible.

## Qualifying Doraf errors

The following qualify for replacement when caused by Doraf:

- wrong checker product delivered,
- malformed PIN,
- mismatched serial number and PIN,
- duplicate voucher pair within one order, or
- fewer voucher pairs delivered or recoverable than the paid quantity.

Delivery-provider failure alone does not qualify while self-service recovery
can return the correct voucher.

## WAEC rejection complaint

For a claim that WAEC reports a voucher as invalid or already used, collect:

- order reference,
- affected voucher position,
- exact WAEC error text, and
- preferably a screenshot.

Do not require the student's Index Number, Examination Year, or other exam
details by default. An Administrator may request the minimum additional
information genuinely needed for a vendor investigation.

There is no short claim deadline based solely on order age because an unused
voucher has no calendar expiration. Evidence strength and vendor verification
may affect the decision.

## Replacement

Only an Administrator can approve replacement.

An approved replacement:

1. Preserves the original voucher's sold allocation.
2. Marks its dispute disposition as `REPLACED`.
3. Ensures it can never return to available inventory.
4. Allocates one available voucher of the same checker product.
5. Marks the replacement voucher sold and links it to the original order and
   voucher.
6. Creates audited delivery work to the order's original destinations.

The standard policy permits one replacement per original voucher. A subsequent
claim requires explicit Administrator investigation and a recorded exceptional
decision.

Replacement does not create another agent credit and does not reverse the
original agent profit.

## Refund

Excess payments enter a `REQUESTED` refund queue. An Administrator lists and
approves them with a recorded reason; approval creates durable provider-submission
work but does not itself call Paystack. Provider submission and reconciliation
remain asynchronous so an approval transaction never waits on an external API.

If Doraf cannot supply a valid replacement, an Administrator can refund the
affected unit.

For each refunded voucher unit:

- refund its immutable unit retail-price snapshot,
- append one agent-profit reversal debit equal to its immutable unit profit,
- link both movements to the dispute, order, and voucher, and
- preserve the voucher as permanently unavailable.

The agent wallet may become negative under the existing payment-reversal rules.

A duplicate or excess payment refund has no agent-wallet effect because Doraf
did not append another sale-profit credit.

Refund and wallet effects must be idempotent. Repeated provider callbacks or
operator actions cannot refund or debit the same unit twice.

## Non-qualifying claims after delivery

The following are not refundable or replaceable after the secret was delivered:

- buyer selected the wrong checker after its supported scope was displayed,
- buyer confirmed an incorrect delivery phone number or email,
- voucher was used for an unsupported examination type,
- buyer attempted a fourth result check,
- buyer attempted to use it for another candidate, or
- buyer attempted to use it for a different examination year than the first
  candidate lock.

An Administrator may record an exceptional goodwill action, but it is not an
entitlement under the standard policy and must be separately audited.

## Audit

Record:

- Support intake and classification,
- evidence upload and access,
- Administrator decision and reason,
- original and replacement voucher identifiers,
- delivery work,
- refund reference and status,
- wallet entry identifiers, and
- all exceptional overrides.

Audit records and ordinary interfaces mask voucher secrets and unnecessary
student information.

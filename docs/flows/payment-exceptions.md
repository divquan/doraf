# Payment exception flows

Status: Confirmed product flow  
Last updated: 2026-07-30

## Order payment expiry

- An order's pricing snapshot is payable for 15 minutes after confirmation.
- An order permits at most three payment attempts.
- Only one attempt can be active at a time.
- Expiry prevents a new attempt.
- An attempt initiated before expiry remains valid through its normal payment
  and reconciliation lifecycle.
- A buyer who reaches the time or attempt limit must create a new order at
  current pricing.

## Missing Paystack webhook

1. Wait through Paystack's 180-second Mobile Money authorization window.
2. If success was not received, call transaction verification.
3. If successful, complete the order normally.
4. If terminally failed or abandoned, fail the attempt and release inventory.
5. If non-terminal, retain inventory and retry verification during a
   five-minute grace period.
6. At the end of the grace period, release inventory while continuing
   background reconciliation.

## Late success after inventory release

1. Confirm reference, amount, currency, and provider authenticity.
2. Attempt to allocate the complete quantity from fresh inventory.
3. If allocation succeeds, complete the normal paid-order transaction.
4. If allocation fails, mark the paid order as requiring Administrator action.
5. The Administrator attempts replacement fulfillment and otherwise refunds the
   payment.

## Duplicate successful payments

1. The first accepted success fulfills and credits the order.
2. Record later successful charges as excess payments.
3. Do not allocate extra vouchers.
4. Do not create another agent profit credit.
5. Send each excess payment through an idempotent refund workflow.

## Mismatched provider result

If reference, currency, or amount does not match:

- do not mark the order paid,
- do not sell inventory,
- do not credit the agent,
- retain safe evidence of the provider result, and
- queue the attempt for Administrator investigation.

## Refund and replacement boundary

A delivered serial-number/PIN pair is normally non-refundable because the
secret has been exposed.

Before refunding an unfulfilled paid order, an Administrator attempts to assign
replacement inventory. Replacement and refund actions are audited and
idempotent.

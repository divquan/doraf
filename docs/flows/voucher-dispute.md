# Voucher dispute flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Intake

1. Buyer provides the order reference.
2. Support locates the order without revealing voucher secrets.
3. Buyer identifies the affected voucher position.
4. Support selects a complaint category and records the exact error.
5. For a WAEC rejection, request the exact error message and preferably a
   screenshot.
6. Avoid collecting student exam details unless escalation genuinely requires
   them.
7. Submit the complaint for Administrator review.

## Administrator investigation

1. Review order, product, payment, allocation, delivery, recovery, and prior
   dispute history.
2. Access raw voucher data only when necessary and through an audited action.
3. Determine whether the issue is:
   - Doraf error,
   - credible invalid or previously used inventory,
   - buyer selection or delivery-entry error,
   - buyer misuse, or
   - unresolved.
4. Record the decision and reason.

## Replacement path

1. Confirm the affected voucher has not already received its standard
   replacement.
2. Preserve the original sold allocation and mark it `REPLACED`.
3. Atomically allocate a same-product replacement.
4. Link replacement, original voucher, dispute, and order.
5. Create delivery work for the original destinations.
6. Preserve the original agent profit credit unchanged.

## Refund path

Use this path only when a qualifying issue cannot be resolved with valid
replacement inventory:

1. Calculate the affected unit's immutable retail price and agent profit.
2. Create an idempotent partial refund for the unit retail price.
3. Append one idempotent agent-profit reversal debit.
4. Keep the affected voucher permanently unavailable.
5. Track the provider refund to a terminal status.

## Rejected claim

For a non-qualifying claim:

1. Record the policy reason.
2. Give Support safe buyer-facing language.
3. Do not reveal internal risk rules or voucher secrets.
4. Do not change inventory, payment, or wallet state.

## Exceptional goodwill

Only an Administrator may grant an exception. The record distinguishes a
goodwill action from a policy-entitled replacement or refund and captures the
reason and financial effect.

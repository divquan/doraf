# Online purchase flow

Status: Confirmed product flow  
Last updated: 2026-08-08

## Preconditions

- The sales link resolves to an active agent.
- The selected checker product is active.
- The agent has a valid effective retail price for the product.
- The requested quantity is between one and five.
- Enough product inventory exists to proceed to payment.

## Buyer input and review

1. Resolve and preserve the agent attribution from the personalized link.
2. Let the buyer select one checker product and a quantity from one to five.
3. Collect the required SMS delivery number twice and require an exact
   normalized match.
4. Optionally collect a delivery email twice and require a normalized match.
5. Show a final review containing:
   - checker name and supported examinations,
   - three-use and single-candidate/year restrictions,
   - quantity,
   - unit price and final total,
   - SMS delivery number,
   - optional delivery email, and
   - a clear notice that payment details are collected securely by Paystack.
6. Require explicit buyer confirmation.

## Order and payment initiation

1. Create the order and immutable pricing and attribution snapshot.
2. Atomically reserve the complete requested voucher quantity.
3. Create a payment attempt and unique Paystack reference.
4. Generate the synthetic Paystack email from the normalized delivery phone.
5. Persist the attempt before or atomically with requesting the Paystack hosted
   checkout.
6. Open Paystack's hosted collection flow. Doraf does not collect or persist
   the payer number or network for new web orders.
7. Tell the buyer to authorize the prompt within Paystack's 180-second window.
8. If Paystack initialization is temporarily uncertain, the checkout keeps the
   same order and reference while the server safely retries initialization. A
   valid checkout session can then receive the recovered access code and reopen
   the hosted window.

If complete inventory cannot be reserved, do not initiate payment.

## Successful payment

Paystack may report success through a webhook or transaction verification. The
hosted popup's `onSuccess` callback now triggers one immediate server-side
verification for a faster buyer experience, but the callback is only an
accelerator. Doraf verifies the authenticity and matches the reference, amount,
and currency to the expected attempt.

In one short internal transaction:

1. Mark the payment attempt successful.
2. Mark the order paid.
3. Convert all reserved vouchers to sold.
4. Append the agent's profit credit to the wallet ledger exactly once.
5. Create durable SMS delivery work.
6. If provided, create durable email delivery work.

After commit, workers send the SMS and optional email. Delivery retries are
idempotent and do not change the commercial outcome.

## Failed or missing payment result

- On terminal failure, mark the attempt failed and release its inventory.
- If no webhook arrives by the end of the authorization window, verify with
  Paystack before releasing inventory.
- If verification is non-terminal, retain the reservation for a configurable
  reconciliation grace period and verify again.
- After terminal failure, the buyer may retry the same order. Doraf creates a
  new payment attempt, Paystack reference, and inventory reservation.
- Once an order exists, the buyer cannot go back and create a second active
  reservation from the same checkout; they can close the modal and resume the
  existing order instead.
- A short-lived checkout access token authorizes status-linked voucher reveal
  and retries for the browser session. The public status response contains
  delivery progress only, never voucher serials or PINs.
- Once one attempt succeeds, no other attempt can charge or fulfill the order.

## Delivery failure

A failed SMS or email attempt does not:

- make a sold voucher available,
- reverse the payment,
- remove the agent's wallet credit, or
- change the immutable delivery destination.

Doraf retries delivery and permits buyer recovery using the order reference and
verification of the delivery phone number.

## Open policies

- How long the original order price remains payable after a failed attempt
- Maximum payment retries per order
- Reservation reconciliation grace-period duration
- Email validation beyond double entry
- Buyer-facing behavior when one of two delivery channels succeeds
- Refund and replacement policy when delivery cannot be recovered

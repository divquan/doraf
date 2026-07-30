# USSD purchase flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Entry and agent attribution

1. The buyer dials a shared Doraf USSD service code.
2. If the provider supports parameters in the dial string, the agent's unique
   referral code is included.
3. Otherwise, Doraf prompts the buyer to enter the referral code.
4. Doraf resolves the code and verifies that the agent can receive new sales.
5. Doraf shows the agent's identity before final purchase confirmation.

An invalid, disabled, or suspended agent code returns a safe error and does not
create an order.

## Product and contact selection

1. Show the three checker products.
2. Let the buyer select one product.
3. Explain the supported examination types in compact USSD copy.
4. Let the buyer select a quantity from one to five.
5. Use the USSD session phone number as the default SMS delivery number.
6. Let the buyer keep or replace the delivery number.
7. Use the session phone number as the default Mobile Money payer number.
8. Let the buyer keep or replace the payer number.
9. Let the buyer select the payer's Mobile Money network.

USSD checkout does not collect an email address.

## Review and confirmation

Doraf shows a compact review containing:

- agent identity,
- checker product,
- quantity,
- total retail price,
- delivery phone number,
- payer phone number, and
- payer network.

The buyer explicitly confirms before Doraf creates an order.

## Payment handoff

After confirmation:

1. Create the order with immutable attribution and pricing snapshots.
2. Atomically reserve the complete voucher quantity.
3. Create a payment attempt and unique Paystack reference.
4. Generate the synthetic Paystack email from the payer number.
5. Initiate the Mobile Money charge.
6. Tell the buyer to authorize the prompt within 180 seconds.
7. Tell the buyer that purchased vouchers will arrive by SMS.
8. End the USSD session without waiting for the asynchronous result.

If inventory cannot be reserved or payment cannot be initiated, show a safe
failure response and do not leave an active reservation unnecessarily.

## Asynchronous completion

The same core lifecycle as web checkout handles:

- Paystack webhook authentication,
- transaction verification,
- payment reconciliation,
- conversion of reserved vouchers to sold,
- exactly-once agent wallet credit, and
- durable SMS delivery.

The USSD session is not required for any of these steps to complete.

## Buyer messaging

- Successful purchases deliver voucher pairs and the order reference by SMS.
- Terminal payment failures send the order reference and a safe web retry link.
- Non-terminal payments do not claim success or failure prematurely.
- Messages must not include a synthetic Paystack email.

## Open provider and UX details

- Shared service code and provider
- Support for referral parameters in the initial dial string
- Session duration and per-screen character limits
- Exact agent-code alphabet and length
- Agent identity shown to buyers
- Behavior when the session phone number is unavailable or masked
- Whether a non-terminal payment receives an intermediate status SMS

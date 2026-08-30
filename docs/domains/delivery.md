# Voucher delivery

Status: Partial implementation  
Last updated: 2026-08-01

## Channels

Every paid order uses:

- required SMS delivery to one confirmed phone number, and
- optional email delivery to one buyer-provided address for web orders.

Both channels deliver the same serial-number/PIN pairs for every voucher in the
order. The optional delivery email is not the synthetic Paystack email.

## Message composition

Dashchecker sends one SMS per voucher. Each message contains:

- high-entropy order reference,
- checker product,
- voucher position and order quantity,
- serial number,
- 12-digit PIN, and
- the three-use and single-candidate/year reminder.

For example, a quantity-three order creates three SMS delivery items numbered
`1 of 3`, `2 of 3`, and `3 of 3`.

Optional email delivery creates one email containing every voucher in the
order. The email subject contains the order reference and product context but
never a serial number or PIN.

## Trigger

Delivery work is created only after confirmed payment, successful voucher
allocation, and conversion of inventory to sold.

The delivery request must be committed durably in the same internal transaction
as the paid order, sold inventory, and wallet credit. Calling an external SMS or
email provider occurs asynchronously after commit.

## Delivery attempts

Each channel has its own attempt history containing:

- order and channel,
- destination in protected form,
- provider,
- provider message reference,
- attempt number,
- timestamps,
- result and failure classification, and
- safe diagnostic metadata.

A provider API acceptance indicates `SENT` or equivalent, not necessarily final
delivery to the recipient. Provider-specific delivery receipts will determine
which states can be supported.

## Idempotency

Retrying a job must not accidentally generate unrelated delivery work or alter
the voucher allocation. Providers should receive a stable idempotency or client
reference when supported.

The system must avoid sending duplicate messages after a provider accepted a
request but Dashchecker did not receive the response. The exact reconciliation method
depends on the selected providers.

Current implementation uses a persisted pending attempt and a stable
per-attempt client reference before invoking the development adapter. A restart
therefore reuses that reference rather than creating unrelated work. Ambiguous
submission outcomes are placed in `UNKNOWN` and require provider reconciliation;
they are never automatically resent.

## Failure

Failure on one channel does not cancel or suppress retries on the other.
Delivery failure does not reverse payment, wallet credit, or sold inventory.

Buyer recovery remains available using the order reference and verification of
the required delivery phone number.

Status, failure, and successful-delivery messages include the order reference.
A terminal USSD payment failure also includes a safe web retry link.

Terminal failure criteria, email sender, SMS sender ID, and provider selection
remain open.

## Retry policy

An external provider request is attempted immediately. A definite rejection or
failure receives at most three retries:

1. approximately one minute after the initial attempt,
2. approximately five minutes after the initial attempt, and
3. approximately fifteen minutes after the initial attempt.

This produces at most four provider submissions for a delivery item.

The development adapter accepts submissions locally and logs only the channel,
masked destination, and stable reference. It never logs a recipient address or
phone number, serial number, PIN, or rendered voucher content. It runs only in
the development environment; selecting and implementing real providers remains
external work.

If the provider accepted a request but its final status is unknown, Dashchecker
queries or reconciles that request before submitting another. A timeout after
submission is not sufficient proof that the provider rejected it.

SMS and email have independent state and retry histories. Email success does not
cancel SMS work, and SMS success does not cancel requested email work.

## Self-service recovery

Recovery is available immediately after the paid order and sold vouchers are
committed:

1. Buyer supplies the high-entropy order reference.
2. Dashchecker returns the same generic response whether or not the reference exists.
3. For a valid order, Dashchecker sends an OTP to the immutable SMS delivery number.
4. Buyer submits the OTP subject to expiry and attempt limits.
5. Dashchecker displays only the checker product and serial-number/PIN pairs belonging
   to that order.
6. Recovery access is audited and rate-limited.

Recovery does not expose agent identity, payer information, other orders, or
internal pricing. It does not permit the buyer to change a delivery destination.

This flow is implemented through the public `/recover` page and three no-store,
rate-limited API operations. Recovery requests create indistinguishable real or
decoy challenges. A successful OTP verification creates a fingerprinted
ten-minute recovery session scoped to exactly one order; the raw recovery token
is kept in browser memory only while the result is fetched. Challenge request,
verification, and voucher reveal events are persisted without contact data or
voucher values. Production use remains dependent on a provider-backed SMS
adapter.

## Manual resend

Support can inspect masked delivery destinations, attempt history, and safe
provider errors. Support cannot reveal voucher values or trigger delivery.

An Administrator can trigger an audited resend only to the original SMS number
or optional email address stored on the paid order. Manual resend does not alter
the original delivery history.

## Retention and secrecy

Dashchecker retains sold serial-number/PIN pairs encrypted so recovery remains
possible. Raw secrets are excluded from:

- application and provider-integration logs,
- analytics and event payloads,
- ordinary Support interfaces,
- URLs, and
- email subjects.

The legal retention schedule and cryptographic key-management design remain to
be completed during compliance and architecture work.

Delivery failure alone does not cause a refund because the buyer recovery path
remains available.

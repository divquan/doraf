# Voucher recovery flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Self-service recovery

1. Buyer opens the recovery page.
2. Buyer enters the high-entropy Doraf order reference.
3. Doraf responds generically to prevent order-reference enumeration.
4. If the order is eligible, Doraf sends an SMS OTP to its immutable delivery
   phone number.
5. Buyer submits the OTP before expiry and within the allowed attempt count.
6. Doraf displays:
   - checker product,
   - each voucher's position,
   - serial number,
   - 12-digit PIN, and
   - WAEC usage restrictions.
7. Doraf records the successful recovery access.

The page does not display:

- agent identity,
- Mobile Money payer details,
- synthetic or optional email addresses,
- internal base price or profit,
- wallet information, or
- any other order.

## Security behavior

- Order references must be high entropy and non-sequential.
- OTP issuance and submission are rate-limited.
- OTPs expire and cannot be reused.
- Unknown references and ineligible orders receive generic responses.
- Recovery pages must not place voucher secrets in URLs, browser analytics, or
  ordinary logs.
- Responses containing voucher secrets should prevent unintended caching where
  practical.

## Manual resend

If the buyer contacts Support:

1. Support inspects masked history and safe error details.
2. Support escalates a resend request when appropriate.
3. An Administrator reviews and records a reason.
4. Doraf resends only to an original immutable destination.
5. The resend receives its own attempt and audit history.

Neither Support nor the buyer can replace the post-payment destination.

## Refund boundary

Delivery failure does not itself produce a refund. The same sold voucher remains
available through self-service recovery and controlled resend.

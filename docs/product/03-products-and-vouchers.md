# Products and vouchers

Status: Discovery  
Last updated: 2026-07-30

## Product catalog

Dashchecker's MVP catalog contains three distinct WAEC result-checker products.

### BECE Checker

- Intended for Basic Education Certificate Examination results.
- Supports BECE School candidates.
- Supports BECE Private candidates.
- Supports all examination years.

### WASSCE Checker

- Intended for West African Senior School Certificate Examination results.
- Supports WASSCE School candidates.
- Supports all examination years.
- Does not support BECE or private-candidate result types.

### NOV/DEC (Private) Checker

- Intended for private candidates.
- Supports WASSCE Private results.
- Supports ABCE results.
- Supports GBCE results.
- Supports all examination years.

The three checker types are not interchangeable. Product selection must clearly
show the supported examination types before the buyer pays.

## Voucher contents

One WAEC Checker, also called a voucher, is one inventory item containing
exactly:

- an alphanumeric serial number, and
- a 12-digit numeric PIN, including any leading zeroes.

The PIN is a fixed-length string, not a number. The serial number and PIN must
remain paired throughout import, storage, allocation, delivery, recovery, and
support.

The buyer uses both values on an official WAEC result portal alongside the
candidate's Index Number, Examination Year, and Exam Type. Dashchecker does not need
to collect those candidate details to sell the voucher.

## Voucher validity

Unused vouchers have no calendar expiration date. An item may remain in Dashchecker's
available inventory indefinitely provided it has never been used and has not
been invalidated for another operational reason.

A voucher is valid for three result checks. On first use, WAEC locks it to the
candidate's Index Number and Examination Year. The remaining uses cannot be
transferred to another candidate. The voucher also remains restricted to the
examination types supported by its product.

Dashchecker's inventory lifecycle tracks whether the voucher has been sold, not the
number of times the buyer subsequently uses it on a WAEC portal. No integration
providing post-sale usage counts has been identified.

## Order quantities

One order contains between one and five vouchers of exactly one checker product.
It cannot mix BECE, WASSCE, and NOV/DEC (Private) Checkers.

A single order has one:

- agent attribution,
- checker product,
- payer phone number,
- required SMS delivery number,
- optional delivery email,
- payment, and
- pricing snapshot.

Every voucher in the order is delivered to the same required phone number and,
when supplied, the same optional email address.

Whether quantity discounts are ever permitted remains open. The MVP pricing
model applies the same unit retail price to every voucher in the order.

## Buyer communication

Before payment and again during delivery, the buyer should be told:

- which examination types the selected checker supports,
- that the checker cannot be transferred after first use,
- that it supports three result checks for the same candidate and examination
  year, and
- that the serial number and PIN are both required on the WAEC portal.

The wording and placement of these notices remain a UX decision.

## Delivery shape

Each voucher is sent in its own numbered SMS containing the order reference,
checker product, serial number, PIN, and usage reminder. A requested optional
email contains every voucher in one message.

Sold voucher secrets remain encrypted and recoverable through order-reference
and delivery-phone OTP verification.

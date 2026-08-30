# ADR-0013: Use Paystack hosted multi-channel checkout

Status: Accepted  
Date: 2026-08-01

## Context

Collecting a Mobile Money number and network in Dashchecker duplicated payment data
entry and coupled checkout to Paystack's direct charge API. Dashchecker needs a
single payment experience that can use the methods enabled on its Paystack
account without exposing payment secrets to the storefront.

## Decision

The API initializes each payment with Paystack's Transaction Initialize API and
stores the returned access code. The storefront opens Paystack InlineJS with
that code in a popup. Paystack owns payment-method selection and payment-detail
collection. Dashchecker no longer collects or persists payer phone or network details
for new web orders.

Dashchecker verifies the result server-side after the buyer completes checkout, with
the signed webhook retained as the asynchronous confirmation path.

## Consequences

- The available payment methods are controlled by the Paystack dashboard.
- The browser receives a short-lived access code, never the Paystack secret key.
- Existing payer columns are nullable to preserve historic orders.
- Synthetic Paystack email derives from the required delivery phone number.

## Alternatives considered

### Direct Mobile Money charge

Rejected because it forces Dashchecker to collect and validate provider-specific
details and does not allow Paystack to present additional enabled channels.

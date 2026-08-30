# Integration boundaries

Status: Accepted direction  
Last updated: 2026-07-30

## Adapter rule

External providers are accessed through Dashchecker-owned interfaces. Domain modules
use normalized commands and results rather than provider SDK types.

Provider adapters translate:

- request formats,
- authentication,
- references and idempotency,
- status vocabularies,
- error classification,
- retryability, and
- webhook payloads.

Raw provider payloads are retained only where justified, protected, and
excluded from ordinary logs.

## Paystack

Capabilities:

- Ghana Mobile Money charge,
- payment verification,
- refund,
- payment reversal event handling,
- Mobile Money transfer recipient,
- transfer initiation and merchant OTP,
- transfer verification, and
- payment, refund, transfer, fee, and settlement reconciliation.

The adapter does not decide Dashchecker order, inventory, wallet, or refund policy.

## SMS

Capabilities:

- agent and buyer OTP,
- one-voucher delivery messages,
- order and failure status,
- agent notifications,
- provider message status, and
- delivery reconciliation.

OTP and voucher delivery may require distinct sender, throughput, or security
configuration even if one provider supplies both.

## Email

Capabilities:

- optional one-message voucher delivery,
- provider status,
- retry and reconciliation, and
- approved operational notifications.

The adapter must prevent voucher values in subject lines and provider metadata
not required for delivery.

## USSD

Capabilities:

- session identity and phone number,
- agent referral parameters when supported,
- menu request and response,
- replay identifiers,
- session end, and
- provider constraints such as character and time limits.

The USSD adapter never owns the payment or fulfillment lifecycle.

## Object storage

Capabilities:

- private complaint evidence,
- private generated exports,
- malware-scanning workflow,
- short-lived signed access,
- retention and deletion, and
- access audit.

The MVP does not accept voucher inventory source files. If bulk file upload is
introduced later, source-file retention will require an explicit security and
retention decision. Raw batch contents are not an ordinary export.

## Shared contracts

A workspace package may contain:

- validated request and response schemas,
- public identifiers,
- safe enums,
- pagination contracts, and
- generated or inferred TypeScript types.

It must not expose:

- ORM models,
- raw provider payloads,
- voucher encryption structures,
- internal financial entries not intended for a client,
- provider secrets, or
- Administrator-only fields to agent bundles.

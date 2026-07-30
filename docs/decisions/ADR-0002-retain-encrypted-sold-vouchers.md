# ADR-0002: Retain sold voucher secrets for recovery

Status: Accepted  
Date: 2026-07-30

## Context

WAEC vouchers have no calendar expiration, and Doraf cannot observe their
post-sale usage count. Buyers may lose an SMS or experience provider delivery
failure after payment.

Recovery requires Doraf to reproduce the original serial-number/PIN pair.
Deleting or irreversibly hashing sold voucher secrets would make recovery
impossible, while retaining plaintext would create unacceptable inventory and
customer risk.

## Decision

Retain sold voucher serial numbers and PINs in encrypted, recoverable form.

Permit raw-value access only through:

- automated delivery,
- buyer recovery after order-reference and delivery-phone OTP verification, and
- audited Administrator workflows.

Exclude raw secrets from URLs, logs, analytics, ordinary Support tools, and
email subjects.

## Consequences

- Buyers can recover vouchers after delivery failure or message loss.
- Delivery failure does not require returning a voucher to inventory.
- Doraf must operate encryption keys and tightly controlled decryption paths.
- A database compromise alone should not reveal plaintext voucher inventory.
- Key compromise remains a high-impact risk requiring monitoring and rotation.
- Legal retention and deletion obligations still require qualified review.

## Alternatives considered

### Delete sold voucher secrets after delivery

Rejected because Doraf could not support recovery for vouchers without calendar
expiration.

### Store only a non-reversible hash

Rejected because hashes can detect equality but cannot reproduce the serial
number and PIN for the buyer.

### Store plaintext secrets

Rejected because database and internal access would expose the platform's
inventory and buyers' purchased credentials.

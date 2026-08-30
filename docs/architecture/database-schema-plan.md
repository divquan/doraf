# Physical database schema plan

Status: Accepted implementation plan  
Last updated: 2026-07-30

This plan translates the logical model into PostgreSQL and Prisma. It does not
authorize weakening a confirmed business invariant merely because Prisma cannot
express it directly.

## PostgreSQL conventions

### Names

- Tables and columns use `snake_case` in PostgreSQL.
- Prisma models and fields may use idiomatic TypeScript names with `@@map` and
  `@map`.
- Primary keys are named `id`.
- Foreign keys use `<entity>_id`.
- Timestamps use `timestamptz`.
- Every mutable aggregate has `created_at`, `updated_at`, and an integer
  `version` where optimistic coordination is useful.

### Identifiers

- Internal IDs use PostgreSQL `uuid`.
- Defaults use `gen_random_uuid()` through Prisma `dbgenerated`.
- Buyer-facing order references use a separate cryptographically random text
  value with a unique index.
- Provider references are stored in provider-specific columns with unique
  constraints scoped appropriately.
- No public workflow exposes an internal UUID merely as proof of authorization.

### Money

- Monetary minor units use PostgreSQL `bigint`.
- Currency uses a constrained code and is `GHS` in the MVP.
- API contracts serialize minor-unit `bigint` values safely rather than relying
  on JavaScript `number`.
- Display formatting is performed at the contract/UI boundary.

### Protected values

Encrypted values use:

- ciphertext `bytea`,
- encryption key identifier/version,
- format version, and
- a separately stored safe mask where the UI requires one.

Lookup and duplicate detection use keyed HMAC fingerprints stored as `bytea`.
A plain hash is insufficient for phone numbers and 12-digit PINs because their
input spaces can be guessed.

The encryption key and fingerprint key are separate from one another and from
the database.

## PostgreSQL enum plan

Use native PostgreSQL enums only for closed Dashchecker-owned state sets. Provider
names, provider error codes, event names, reason codes, and extensible routing
values use constrained text or lookup tables so adding an integration does not
require changing a central enum.

Initial native enums:

| Enum | Values |
| --- | --- |
| `agent_status` | `ACTIVE`, `SUSPENDED` |
| `internal_user_status` | `ACTIVE`, `SUSPENDED` |
| `internal_role` | `SUPPORT`, `ADMINISTRATOR` |
| `product_status` | `ACTIVE`, `UNAVAILABLE` |
| `voucher_availability` | `AVAILABLE`, `RESERVED`, `SOLD`, `QUARANTINED`, `VOID` |
| `voucher_dispute_disposition` | `NONE`, `REPLACED`, `REFUNDED` |
| `reservation_state` | `ACTIVE`, `CONSUMED`, `RELEASED` |
| `order_payment_state` | `UNPAID`, `PAID`, `PARTIALLY_REFUNDED`, `FULLY_REFUNDED` |
| `order_fulfillment_state` | `PENDING`, `COMPLETE`, `EXCEPTION`, `REFUNDED`, `PARTIALLY_REPLACED` |
| `payment_attempt_state` | `CREATED`, `PENDING_AUTHORIZATION`, `VERIFYING`, `RECONCILING`, `SUCCESS`, `FAILED`, `ABANDONED` |
| `payment_acceptance` | `UNCLASSIFIED`, `ACCEPTED`, `EXCESS` |
| `refund_state` | `REQUESTED`, `SUBMITTED`, `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED` |
| `delivery_state` | `PENDING`, `SUBMITTED`, `DELIVERED`, `UNKNOWN`, `FAILED` |
| `delivery_channel` | `SMS`, `EMAIL` |
| `wallet_hold_state` | `ACTIVE`, `CONSUMED`, `RELEASED` |
| `withdrawal_state` | `REQUESTED`, `APPROVED`, `REJECTED`, `AWAITING_MERCHANT_OTP`, `SUBMITTED`, `PENDING`, `SUCCESS`, `FAILED`, `REVERSED`, `CANCELLED` |
| `dispute_state` | `OPEN`, `UNDER_REVIEW`, `REPLACEMENT_APPROVED`, `REFUND_APPROVED`, `REJECTED`, `UNRESOLVED`, `RESOLVED` |
| `reconciliation_run_state` | `CREATED`, `RUNNING`, `REVIEW_REQUIRED`, `READY_TO_CLOSE`, `FAILED`, `CLOSED` |
| `reconciliation_case_state` | `OPEN`, `ASSIGNED`, `INVESTIGATING`, `ACTION_PENDING`, `RESOLVED`, `REOPENED` |
| `outbox_state` | `PENDING`, `CLAIMED`, `DISPATCHED`, `FAILED` |

Import, export, evidence-scan, channel, credential, and transfer-recipient
states should become native enums only after their exact state machines are
confirmed during the corresponding implementation slice. Until then, use
explicit check constraints local to those tables and do not silently invent
transitions.

Enum values are storage contracts. Renaming or removing a value requires a
forward migration and compatibility analysis; application labels are separate.

## Prisma model groups

The following names are planned Prisma models. Supporting history and join
models are included where a physical relation requires them.

### Identity

#### `AgentTenant`

- `id`
- `createdAt`

Relations:

- one `Agent`

#### `Agent`

- `id`
- `tenantId`
- `name`
- `phoneCiphertext`
- `phoneFingerprint`
- `phoneMask`
- `status`
- `createdAt`
- `updatedAt`
- `version`

Constraints:

- unique `tenantId`
- unique `phoneFingerprint`

#### `AgentPhoneChange`

- `id`
- `agentId`
- old and new protected phone snapshots
- `reason`
- `performedByInternalUserId`
- `createdAt`

#### `OtpChallenge`

- `id`
- `purpose`
- actor or order reference where applicable
- protected destination and fingerprint
- verifier hash
- `expiresAt`
- `attemptCount`
- `consumedAt`
- `createdAt`

#### `Session`

- `id`
- actor type and actor ID
- authentication-strength metadata
- `expiresAt`
- `revokedAt`
- `createdAt`

#### `InternalUser`

- `id`
- protected login identity
- `displayName`
- `role`
- `status`
- `createdAt`
- `updatedAt`

#### `InternalCredential`

- `id`
- `internalUserId`
- credential type
- public credential metadata
- counter and recovery state
- `createdAt`
- `lastUsedAt`
- `revokedAt`

### Agent sales channels

#### `WebSalesChannel`

- `id`
- `agentId`
- immutable public identifier (`webSalesId`)
- editable unique `slug` (3-30 chars, lowercase alphanumeric with hyphens)
- `storeName`, `tagline`, `logoUrl`, `bannerUrl`, `whatsappNumber`, `themePreset`, `announcement`
- `status`
- `createdAt`
- `retiredAt`

#### `UssdReferralCode`

- `id`
- `agentId`
- immutable code
- `status`
- `createdAt`
- `retiredAt`

Identifiers remain unique after retirement.

### Catalog and pricing

#### `Product`

- `id`
- stable `code`
- `name`
- scope and disclosure content/version
- `status`
- display order
- timestamps

#### `ProductPricingPolicy`

- `id`
- `productId`
- `basePriceMinor`
- `maximumRetailPriceMinor`
- `effectiveFrom`
- `effectiveTo`
- Administrator source and reason
- timestamps

#### `AgentPricingOverride`

- `id`
- `agentId`
- `productId`
- optional base-price override
- optional maximum-retail override
- `effectiveFrom`
- `effectiveTo`
- Administrator source and reason
- timestamps

#### `AgentProductPrice`

- `id`
- `agentId`
- `productId`
- `retailPriceMinor`
- `createdAt`
- `updatedAt`
- `version`

Price-change history is preserved through audit and a dedicated history record
if implementation queries require it.

### Inventory

#### `InventoryBatch`

- `id`
- `productId`
- protected or normalized vendor reference
- invoice/reference
- acquisition date
- unit acquisition cost minor
- source row count
- accepted row count
- wrapped batch data key, master-key version, and crypto version
- uploader
- timestamps

Only successfully committed batches are persisted, so a separate import-status
projection is not needed for the initial import model. Failed previews create no
inventory records and are represented by the authenticated audit slice.

#### `Voucher`

- `id`
- `batchId`
- `productId`
- serial ciphertext, fingerprint, mask, and key version
- PIN ciphertext, fingerprint, mask, and key version
- availability state
- dispute disposition
- `createdAt`
- `updatedAt`
- `version`

#### `InventoryEvent`

- `id`
- `voucherId`
- event type
- prior and resulting state
- source type and source ID
- actor where applicable
- safe metadata
- `createdAt`

Append-only.

#### `InventoryReservation`

- `id`
- `orderId`
- `paymentAttemptId`
- state
- `expiresAt`
- timestamps
- `version`

#### `InventoryReservationItem`

- `id`
- `reservationId`
- `voucherId`
- `createdAt`

### Orders and fulfillment

#### `Order`

- `id`
- unique public reference
- `tenantId`
- `agentId`
- channel type and channel ID snapshot
- `productId`
- quantity
- currency
- aggregate base, retail, and profit snapshots
- protected delivery phone, fingerprint, and mask
- optional protected delivery email, fingerprint, and mask
- protected payer phone, fingerprint, and mask
- payer network
- `priceExpiresAt`
- optional accepted payment-attempt ID
- payment and fulfillment projections
- `createdAt`
- `updatedAt`
- `version`

#### `OrderItem`

- `id`
- `orderId`
- position
- `productId`
- unit base, retail, and agent-profit snapshots
- fulfillment and dispute projections
- timestamps

Immutable commercial fields.

#### `VoucherAllocation`

- `id`
- `orderItemId`
- `voucherId`
- allocation kind: original or replacement
- `replacesAllocationId`
- `isCurrent`
- `createdAt`

Historical allocations remain.

### Payments

#### `PaymentAttempt`

- `id`
- `orderId`
- attempt number
- provider
- unique provider reference
- protected synthetic email
- expected amount and currency
- normalized state
- accepted/excess classification
- provider transaction ID
- authorization and reconciliation timestamps
- timestamps
- `version`

#### `PaymentEvent`

- `id`
- `paymentAttemptId`
- provider event identity
- source: webhook or verification
- normalized result
- protected raw-payload object reference or encrypted payload
- processing result
- `receivedAt`
- `processedAt`

Append-only.

#### `Refund`

- `id`
- `paymentAttemptId`
- `orderId`
- optional `orderItemId`
- refund kind and reason
- amount and currency
- unique provider reference
- normalized state
- Administrator and dispute source
- timestamps
- `version`

### Delivery and recovery

#### `DeliveryMessage`

- `id`
- `orderId`
- optional `orderItemId`
- channel
- purpose
- protected destination and mask
- template/version
- state
- scheduled time
- timestamps
- `version`

#### `DeliveryAttempt`

- `id`
- `deliveryMessageId`
- attempt number
- stable client reference
- provider
- provider message reference
- normalized state
- safe error code
- submission and reconciliation timestamps
- `createdAt`

Append-only provider-attempt history.

#### `RecoveryChallenge`

- `id`
- `orderId`
- `otpChallengeId`
- request fingerprint and rate-limit context
- `verifiedAt`
- `createdAt`

### Wallet and withdrawals

#### `WalletAccount`

- `id`
- `agentId`
- currency
- `createdAt`

No mutable balance column.

#### `LedgerEntry`

- `id`
- `walletAccountId`
- signed amount minor
- currency
- entry type
- source type and source ID
- optional order, order-item, withdrawal, or refund relations
- `reversesEntryId` or `compensatesEntryId`
- safe description metadata
- `createdAt`

Append-only.

#### `WalletHold`

- `id`
- `walletAccountId`
- `withdrawalId`
- amount minor
- currency
- state
- `createdAt`
- `consumedAt`
- `releasedAt`
- `version`

#### `Withdrawal`

- `id`
- `walletAccountId`
- `agentId`
- protected destination and mask
- network
- net payout, fee, and total hold minor values
- currency
- state
- Administrator decision and reason
- timestamps
- `version`

#### `TransferRecipient`

- `id`
- `agentId`
- provider
- protected phone fingerprint/snapshot
- network
- provider recipient code
- state
- timestamps

#### `TransferAttempt`

- `id`
- `withdrawalId`
- provider
- unique provider reference
- provider transfer code
- `transferRecipientId`
- amount and currency
- normalized state
- timestamps
- `version`

Provider events may use a separate append-only `TransferEvent` model.

### Disputes

#### `Dispute`

- `id`
- `orderId`
- `orderItemId`
- category
- buyer-reported error
- state
- Support intake actor
- Administrator decision, reason, and actor
- timestamps
- `version`

#### `DisputeEvidence`

- `id`
- `disputeId`
- private object key
- media type and size
- malware-scan state
- retention state
- uploader
- timestamps

#### `VoucherReplacement`

- `id`
- `disputeId`
- `orderItemId`
- original allocation ID
- replacement allocation ID
- Administrator actor and reason
- `createdAt`

### Platform operations

#### `AuditEvent`

- `id`
- actor type and actor ID
- actor role snapshot
- action
- reason
- entity type and ID
- authentication strength
- correlation ID
- masked before/after metadata
- `createdAt`

Append-only.

#### `OutboxEvent`

- `id`
- event type
- aggregate type, ID, and version
- safe payload
- state
- available time
- attempt count
- claim and completion timestamps
- last safe error
- `createdAt`

#### `IdempotencyRecord`

- `id`
- scope
- key
- operation
- request fingerprint
- outcome type and ID
- response status where appropriate
- `expiresAt`
- `createdAt`

#### `GeneratedExport`

- `id`
- export type
- requester
- authorization snapshot
- safe filters
- state
- private object key
- `expiresAt`
- timestamps

### Reconciliation

#### `ReconciliationRun`

- `id`
- run type
- Accra reporting date
- UTC source cutoffs
- source/query fingerprints
- immutable totals
- state
- reviewer
- timestamps

#### `ReconciliationCase`

- `id`
- `reconciliationRunId`
- category and severity
- source links
- affected amount or item count
- evidence
- assignee
- state
- resolution and corrective-action link
- timestamps
- `version`

## Models intentionally omitted

- Mutable wallet balance
- General-purpose customer account
- Shopping cart with mixed products
- Agent team membership
- Raw voucher export
- Generic administration record editor
- Provider payload used directly as a domain model

# Delivery phases

Status: Confirmed sequence  
Last updated: 2026-07-30

The phases describe dependency order and usable increments. External,
compliance, design, and engineering work can overlap. Production launch remains
blocked until every required gate is complete.

## Phase 0 — External readiness

### Outcomes

- Confirm product and vendor authority.
- Select and engage Paystack, SMS, email, and USSD providers.
- Obtain sandbox credentials and current integration specifications.
- Begin data-protection, payment-regulatory, tax, accounting, and minor-related
  reviews.
- Confirm production domains, sender identities, and USSD feasibility.

### Exit criteria

- Providers can support the confirmed model in writing or sandbox behavior.
- No known external constraint invalidates the MVP architecture.
- Compliance gates have owners, evidence requirements, and target dates.

This phase need not finish every launch approval before local engineering, but a
blocking provider or legal issue must not be ignored.

## Phase 1 — Core foundation

### Outcomes

- Core domain and database conventions
- Agent and internal identity
- Tenant and role authorization
- OTP and stronger internal authentication foundations
- Immutable audit records
- Application configuration and environment isolation
- Background jobs, durable outbox, and idempotency foundations
- Observability, secrets, encryption, and test infrastructure

### Exit criteria

- Cross-tenant authorization tests pass.
- Internal roles enforce confirmed permissions.
- Sensitive audit events are durable.
- Non-production cannot perform production money movement.
- Core concurrency and idempotency primitives are proven.

## Phase 2 — Supply, catalog, and agent configuration

### Outcomes

- Three-product catalog
- Default and per-agent pricing policies
- Individual agent onboarding
- Permanent web links and USSD referral codes
- Agent retail-price setup
- Encrypted inventory batch validation and import
- Inventory state management and low-stock alerts
- Administration workflows for these capabilities

### Exit criteria

- Valid batches import atomically and invalid batches do not.
- Duplicate voucher detection and secret masking pass.
- Agent pricing and channel attribution are deterministic.
- Concurrent allocation tests cannot duplicate a voucher.

## Phase 3 — Web sale

### Outcomes

- Public agent storefront
- Guest checkout
- Immutable order and pricing snapshot
- Inventory reservation
- Paystack payment attempts and webhooks
- Successful allocation and sale
- Exactly-once agent credit
- SMS and optional email delivery

### Exit criteria

- A real-shaped sandbox payment completes end to end.
- Repeated callbacks do not duplicate sale, inventory, wallet, or delivery work.
- Failed payments release inventory under the confirmed policy.
- No external provider is called before internal commercial commit.

## Phase 4 — Recovery and exception handling

### Outcomes

- Payment verification and background reconciliation
- Late and duplicate payment handling
- Buyer voucher recovery
- Delivery reconciliation and retries
- Dispute intake
- Replacement and partial refund
- Payment reversal and negative wallet balance
- Administration exception queues

### Exit criteria

- Each documented exception flow is integration-tested.
- Recovery does not expose other orders or personal information.
- Refund and replacement actions are idempotent.
- Replaced and refunded voucher items never return to sale.

## Phase 5 — Agent finance and portal

### Outcomes

- Complete agent dashboard and reporting
- Wallet ledger and transaction history
- Withdrawal holds and requests
- Administrator approval
- Paystack Mobile Money transfers and reconciliation
- Agent notifications and privacy-safe exports
- Suspended read-only portal

### Exit criteria

- Concurrent withdrawals cannot overspend a wallet.
- Transfer events cannot debit or release funds twice.
- Sale reversals can create and recover from negative balances correctly.
- Agent reports reconcile to canonical orders and ledger entries.

## Phase 6 — USSD channel

### Outcomes

- Shared USSD service integration
- Direct or prompted agent referral code
- Product, quantity, delivery, payer, and network menus
- Asynchronous Paystack handoff
- Failure and status SMS
- Shared backend purchase lifecycle

### Exit criteria

- Session replay does not duplicate orders or payment attempts.
- Session timeout cannot interrupt paid-order fulfillment.
- Agent attribution remains correct.
- Provider character and duration limits pass tested scripts.

## Phase 7 — Reporting and operations

### Outcomes

- Complete administration and Support portals
- Canonical dashboards
- Continuous invariant checks
- Daily reconciliation
- Assigned discrepancy cases
- Inventory, finance, wallet, settlement, and delivery-cost exports
- Operational alerting and queue ownership

### Exit criteria

- A full test period reconciles to zero unexplained value or inventory
  difference.
- Closed runs remain reproducible after late events.
- Every critical queue has ownership, alerts, and resolution procedures.
- Exports enforce masking, authorization, expiry, and audit.

## Phase 8 — Production readiness and launch

### Outcomes

- Provider live-mode certification and controlled checks
- Threat model and security assessment
- Penetration test and remediation
- Backup restoration and disaster-recovery exercise
- Incident and voucher-compromise exercise
- Privacy, retention, rights, and breach procedures
- Operator training and runbooks
- Completed external launch gates
- Go-live and rollback plan

### Exit criteria

- `docs/planning/compliance-launch-gates.md` is evidenced complete where
  applicable.
- Critical security findings are resolved.
- Production access, alerting, on-call ownership, and rollback are tested.
- Finance, inventory, Support, and administration operators sign off.
- Launch decision and known residual risks are recorded.

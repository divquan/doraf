# MVP scope

Status: Confirmed  
Last updated: 2026-07-30

## MVP objective

Launch a controlled B2B2C marketplace in Ghana where an individual agent can
set prices and share permanent sales channels, a guest buyer can pay for one to
five same-product WAEC vouchers using Mobile Money, Doraf can fulfill from
central inventory, and the agent can withdraw auditable earnings.

The MVP is not complete merely when the happy-path checkout works. It includes
the operational, accounting, security, recovery, and reconciliation controls
needed to operate real money and secret voucher inventory.

## Included

### Identity and access

- Individual agent registration with name and phone number
- Agent SMS OTP authentication
- One user per agent tenant
- Manual Administrator account recovery
- Administrator and Support internal roles
- Stronger internal authentication and step-up actions
- Agent suspension and read-only suspended portal

### Products and pricing

- BECE Checker
- WASSCE Checker
- NOV/DEC (Private) Checker
- Default product base price and retail maximum
- Per-agent base-price and retail-maximum overrides
- Agent-selected retail price per product
- Immutable order pricing snapshots

### Inventory

- Central platform-owned inventory
- Product-specific CSV batch import
- Whole-batch validation and row-level errors
- Vendor, invoice, acquisition date, and unit cost
- Encrypted serial-number/PIN pairs
- Availability, reservation, sale, quarantine, and terminal dispositions
- Low-stock alerts
- Replacement linkage and disputed inventory handling

### Sales channels

- One permanent personalized web link per agent
- One permanent USSD referral code per agent
- Shared USSD service
- Immutable agent and channel attribution
- Codes never reassigned

### Buyer checkout

- Guest web checkout
- Guest USSD checkout
- One checker product per order
- Quantity from one to five
- Required SMS delivery number
- Optional email delivery on web
- Separate Mobile Money payer number and network
- Product-scope and usage disclosures

### Payments

- Paystack Ghana Mobile Money
- Synthetic Paystack email
- Pre-payment inventory reservation
- 180-second authorization window and verification
- Five-minute reconciliation grace period
- Fifteen-minute order-price validity
- Three payment attempts per order
- Idempotent webhooks and verification
- Late and duplicate payment handling
- Payment reversals and mismatch investigation

### Fulfillment and buyer recovery

- One SMS per voucher
- One optional email containing all order vouchers
- Controlled delivery retries and provider reconciliation
- High-entropy order references
- Self-service recovery using delivery-phone SMS OTP
- Administrator resend only to original destinations
- Encrypted retention of sold voucher secrets

### Agent ledger and withdrawals

- Append-only earnings ledger
- Sale, reversal, refund, payout, fee, and compensating entries
- Active withdrawal holds
- Positive, held, withdrawable, and negative balance views
- Paystack Ghana Mobile Money withdrawal to registered number
- Fresh agent OTP and Administrator approval
- Paystack merchant transfer OTP
- Idempotent transfer reconciliation

### Disputes, replacements, and refunds

- Support complaint intake with masked vouchers
- Administrator evidence review
- One standard same-product replacement per voucher
- Partial refund when valid replacement is unavailable
- Per-unit agent profit reversal on qualifying refund
- Audited goodwill exceptions

### Agent portal

- Dashboard and reporting periods
- Permanent sales-channel sharing
- Product pricing and binary availability
- Privacy-safe order history
- Wallet, ledger, and withdrawal history
- Notifications
- Privacy-safe CSV exports

### Administration and Support portals

- Operational and inventory dashboards
- Product, pricing, batch, agent, and account management
- Payment, fulfillment, withdrawal, delivery, dispute, and reconciliation queues
- Masked order investigation
- Step-up individual voucher reveal
- Immutable audit explorer
- Purpose-specific expiring exports

### Reporting and operations

- Canonical metric definitions
- Continuous invariant checks
- Immutable daily reconciliation runs
- Assigned discrepancy cases
- Payment, inventory, wallet, transfer, settlement, and delivery-cost
  reconciliation
- Monitoring, alerting, backup, and incident readiness

### Compliance and launch readiness

- Data Protection Commission readiness and registration
- Payment and earnings-ledger regulatory review
- Paystack production onboarding
- WAEC-vendor authorization
- Tax and accounting review
- Provider and processor agreements
- Privacy notices, retention, rights, and breach procedures
- Security assessment and production controls

## Explicitly outside the MVP

### Accounts and organizations

- Business or organization agent accounts
- Agent staff, invitations, teams, or delegated roles
- Buyer accounts
- Doraf-operated agent KYC

### Money movement

- Bank-account withdrawal
- Third-party payout destinations
- Cash or Mobile Money wallet top-up
- Buyer deposits
- Agent-to-agent or peer-to-peer transfer
- Interest
- Spending agent balance inside Doraf
- Multiple currencies
- Additional payment gateways

### Sales and merchandising

- Mixed-product orders
- More than five vouchers per order
- Coupons, promotions, or quantity discounts
- Custom domains
- Custom storefront branding
- Multiple campaign links or USSD codes
- Customer lists, CRM, or buyer marketing

### Applications and automation

- Native iOS or Android applications
- Automated dispute approval
- Bulk export of raw voucher secrets
- Agent access to voucher secrets
- Generic administration database editing

## MVP completion definition

The MVP is ready for production only when:

- all included critical paths and exception paths are tested,
- financial and inventory invariants pass under concurrency and repeated events,
- provider sandbox and approved live checks pass,
- reconciliation can explain every test payment, voucher, ledger entry, refund,
  and withdrawal,
- security and recovery exercises pass,
- production monitoring and incident ownership exist, and
- all applicable launch gates are evidenced as complete.

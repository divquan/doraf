# Open questions

Status: Active  
Last updated: 2026-07-30

This is the discovery backlog. Answers should be moved into the appropriate
product or domain document. Material decisions should also receive a decision
record.

## Topic 1 — Actors, tenancy, and permissions

The MVP role and account model is substantially resolved. The remaining policy
details can be addressed alongside security and operational flows.

### Remaining policy details

1. What evidence must Support collect to recover an agent account or change its
   phone number?
2. Should account recovery impose a temporary withdrawal hold?
3. How long must sensitive-action audit records be retained?

## Resolved in Topic 1

- MVP agents are individuals only.
- Agent registration requires a name and phone number.
- Agent identity verification is not included in the MVP.
- Each agent tenant contains one user.
- Buyers can purchase as guests.
- The PIN delivery number may differ from the Mobile Money payer number.
- Agents authenticate with a phone number and SMS OTP.
- One phone number can have only one agent account.
- An Administrator handles account recovery manually in the MVP.
- Suspended agents retain read-only historical access but cannot receive new
  sales.
- Withdrawals by suspended agents require an administrator's decision.
- Buyers confirm delivery numbers by entering them twice; delivery-number OTP
  verification is outside the MVP.
- The MVP has Administrator and Support internal roles.
- Internal operators cannot impersonate agents.
- Support has read-only investigation access with masked PIN data.
- Administrators manage inventory, money operations, suspensions, recovery, and
  configuration.
- Inventory uploads do not require second-person approval.
- Sensitive administrative actions are audited with an operator and reason.
- Withdrawal requests require a fresh SMS OTP.
- Account recovery requires an Administrator, a recorded reason, and OTP
  verification of the replacement number.
- Buyers can recover a PIN using an order reference and verification of the
  delivery phone number.

## Next topic

- Remaining infrastructure and provider choices

## Resolved in Topic 2 — Pricing and platform revenue

- Each PIN product has a platform-defined base price and retail maximum.
- The base price covers acquisition cost, operating costs, and Doraf's margin.
- Agents set a retail price within their effective pricing range.
- Agent profit is retail price minus effective base price.
- Buyers see one final price without checkout surcharges.
- Orders store immutable pricing snapshots.
- Prices are in GHS with two-decimal precision.
- One agent price applies to both web and USSD for a given product.
- Administrators can set per-agent base-price and retail-maximum overrides.
- Support can inspect pricing but cannot modify it.
- Policy changes affect new orders only and clamp invalid active agent prices.

## Resolved in Topic 3 — Products and voucher contents

- The catalog contains BECE, WASSCE, and NOV/DEC (Private) Checkers.
- BECE Checkers support BECE School and Private results across all years.
- WASSCE Checkers support WASSCE School results across all years.
- NOV/DEC Checkers support WASSCE Private, ABCE, and GBCE results across all
  years.
- A voucher consists of one alphanumeric serial number and one 12-digit PIN.
- The serial number and PIN must remain paired.
- Buyers can purchase multiple vouchers in one order.
- Unused inventory has no calendar expiration.
- Each sold voucher supports three checks and locks to one candidate and
  examination year after first use.
- Doraf does not currently track the voucher's post-sale WAEC usage count.

## Open in Topic 3 — Inventory policy

The core inventory policy is resolved. Reservation grace-period duration and
operational stock thresholds will be finalized during payment and operations
design.

## Resolved payment integration details

- Guest buyers are not required to provide email addresses.
- Doraf generates a synthetic email from the normalized Mobile Money payer
  number for Paystack.
- The synthetic email uses a merchant-controlled guest subdomain.
- Doraf stores it with the payment attempt and passes it to Paystack.
- The synthetic email is not buyer-provided contact information.
- Buyers may optionally provide a real email for voucher delivery.
- The optional delivery email remains separate from Paystack's synthetic email.

## Open payment integration details

1. Which production domain and phone-number normalization format should be used
   for synthetic Paystack emails?
2. How should inbound mail to the synthetic-email subdomain be handled?

## Resolved in Topic 3 — Inventory policy

- An order contains one to five vouchers of one checker product.
- All vouchers use one required SMS number and one optional delivery email.
- Inventory is uploaded in product-specific CSV batches.
- Batches record vendor, invoice/reference, acquisition date, unit cost,
  uploader, and import timestamp.
- One invalid or duplicate row rejects the whole batch with row-level errors.
- The complete order quantity is reserved before Paystack initiation.
- The reservation covers Paystack's 180-second authorization window.
- Doraf verifies an unconfirmed transaction before releasing inventory.
- Non-terminal results retain inventory for a configurable reconciliation
  grace period.
- Sold vouchers never return to available inventory after delivery failure.

## Resolved in Topic 4 — Online purchase

- Checkout validates an active agent and gathers product, quantity, delivery,
  payer, and network details.
- Delivery phone and optional delivery email are each entered twice.
- The buyer reviews product scope, usage restrictions, final price, and
  destinations before confirming.
- Confirmation creates the immutable order and price snapshot.
- Inventory is reserved before Paystack initiation.
- A verified success marks payment and order paid, sells inventory, appends one
  wallet credit, and creates durable delivery work.
- Provider calls occur asynchronously after the internal transaction commits.
- SMS or email failure does not reverse the commercial outcome.
- A terminally failed attempt releases inventory.
- A retry uses the same order but a new attempt, provider reference, and
  reservation.
- Paid-order pricing and delivery details cannot be changed.

## Open after Topic 4

The delivery and dispute policies now define recoverable delivery and qualifying
replacement behavior.

## Superseded Topic 5 — USSD purchase

USSD was removed from the MVP by product-owner decision on 2026-08-01. The
items below are retained as post-MVP discovery history.

- Doraf uses one shared USSD service code and one short unique referral code per
  agent.
- The direct dial string contains the agent code when the provider supports it.
- Otherwise, the buyer enters the agent code inside the session.
- Doraf validates the agent and displays agent identity before confirmation.
- The USSD session number defaults the SMS delivery and payer numbers.
- Buyers may replace either number and select the payer network.
- USSD supports one product and a quantity from one to five per order.
- Optional email delivery is omitted from USSD checkout.
- The buyer reviews attribution, product, price, delivery, and payer details.
- USSD ends after Paystack initiation without awaiting payment confirmation.
- Core payment, inventory, wallet, and delivery processing is shared with web
  checkout.
- Terminal failure sends an SMS with the order reference and safe retry link.
- Successful delivery includes the order reference.

## Deferred until after MVP

1. Which USSD provider and shared code will Doraf use?
2. Does the provider support agent codes in the initial dial string?
3. What agent-code length and alphabet fit the provider and buyer experience?
4. Should retired agent codes ever be reused?
5. What should happen if the provider does not supply the session phone number?

## Resolved payment-reversal policy

- A provider reversal does not alter or delete the original sale credit.
- Doraf appends an equal reversal debit to the agent wallet.
- The wallet balance may become negative.
- Future earnings offset a negative balance.
- No funds are withdrawable until the wallet balance becomes positive.
- Reversal processing must be idempotent and linked to the original payment,
  order, and credit.

## Open wallet effects

1. Should Doraf define a maximum negative balance before administrative action?
2. How should Doraf handle a payment that is reinstated after reversal?

## Resolved payment exceptions and reconciliation

- An order price is payable for 15 minutes after confirmation.
- An order permits three payment attempts and one active attempt at a time.
- An attempt started before order expiry may complete normally.
- A non-terminal Paystack result receives a five-minute reconciliation grace
  period after the initial 180-second authorization window.
- Inventory is released after the grace period while background reconciliation
  continues.
- Late success allocates fresh inventory or enters the Administrator refund
  queue.
- Duplicate success fulfills and credits once; excess payments are refunded.
- Reference, amount, or currency mismatch prevents fulfillment and requires
  investigation.
- Exposed voucher secrets are normally non-refundable.
- Duplicate charges and irrecoverably unfulfilled paid orders are refundable.
- Doraf tries audited replacement inventory before refunding an unfulfilled
  paid order.

## Resolved in Topic 6 — Wallet withdrawals

- MVP payouts use Paystack Ghana Mobile Money Transfers.
- Payouts go only to the agent's registered phone number.
- Bank and third-party-destination withdrawals are outside the MVP.
- Each request requires a fresh Doraf SMS OTP.
- Net payout is GHS 10 to GHS 50,000, subject to a lower Doraf limit.
- The agent pays the GHS 1 Mobile Money transfer fee.
- A hold for payout plus fee is placed atomically at request time.
- Every request requires Administrator approval.
- Paystack merchant transfer OTP remains enabled during the MVP.
- Non-terminal provider status retains the hold.
- Success posts payout and fee debits; failure releases the hold.
- A provider reversal releases the hold or appends compensating credits.
- A pre-initiation sale reversal can cancel an underfunded withdrawal.
- A reversal after transfer initiation may produce a negative wallet balance.
- Negative balances block withdrawals but not new sales.
- Future earnings offset negative balances and Administrators are alerted.

## Resolved in Topic 7 — Delivery and recovery

- Doraf sends one numbered SMS per voucher.
- Each voucher SMS includes order reference, product, serial number, PIN, and
  usage reminder.
- Optional email sends every voucher in one email without secrets in its
  subject.
- A definite delivery failure receives three retries at approximately 1, 5, and
  15 minutes.
- Provider-accepted requests with unknown outcomes are reconciled before resend.
- SMS and email delivery histories remain independent.
- Self-service recovery uses order reference and SMS OTP to the immutable
  delivery number.
- Recovery exposes only the selected order's checker and voucher pairs.
- Support sees masked history; only Administrators can trigger an audited resend.
- Resends go only to original destinations.
- Sold voucher secrets are retained encrypted for recovery.
- Delivery failure alone does not produce a refund.

## Resolved in Topic 8 — Disputes, replacements, and refunds

- Support records complaints with masked voucher access.
- Only Administrators decide and execute replacements or refunds.
- Doraf data and fulfillment errors qualify for replacement.
- Invalid or already-used claims require exact error evidence and preferably a
  screenshot.
- No short claim deadline exists solely because of purchase age.
- Student exam details are collected only when genuinely necessary.
- Replaced vouchers remain unavailable and link to same-product replacements.
- Standard policy permits one replacement per voucher.
- Replacement does not alter agent profit.
- If replacement is impossible, refund the affected unit and reverse that
  unit's agent profit.
- Duplicate-payment refunds have no wallet effect.
- Confirmed wrong product or destination and buyer misuse are non-refundable
  after secret delivery.
- All dispute evidence, decisions, inventory, refunds, and wallet effects are
  audited.

## Resolved in Topic 9 — Agent portal

- Agents receive one permanent web link.
- Permanent web identifiers are never reassigned.
- Agents can copy and share the web link.
- Agents manage one retail price per product within their effective range.
- Product availability is binary; central quantities and costs are hidden.
- Dashboard summaries cover today, 7 days, 30 days, and lifetime.
- Order history shows commercial details and masked delivery numbers.
- Payer numbers, delivery emails, voucher secrets, and full buyer contact data
  are hidden from agents.
- Wallet views distinguish ledger balance, holds, withdrawable, and negative
  balances.
- Agents see withdrawal and ledger history.
- Agents receive sale, pricing, reversal, negative-balance, and withdrawal
  notifications.
- CSV exports exclude personal data, voucher secrets, and internal costs.
- Suspended agents retain a read-only portal.
- Custom branding, domains, campaigns, customer lists, and staff are outside
  the MVP.

## Open after Topic 9

1. Which agent events use in-portal notification, SMS, or both?
2. Does Doraf assign a default retail price before an agent sets one?
3. Resolved 2026-08-01: the MVP web link is `/buy/{public-id}` using a
   non-sequential lowercase 24-character hexadecimal identifier. USSD is
   deferred until after the MVP.

## Resolved in Topic 10 — Administration portal

- The operational dashboard covers sales, payments, fulfillment, wallet
  liabilities, withdrawals, refunds, delivery failures, disputes, negative
  wallets, and inventory health.
- Administrators see exact internal inventory counts and low-stock alerts.
- Inventory imports use validation preview, row errors, and explicit commit.
- Batch history includes vendor, invoice, acquisition, cost, uploader, and
  reconciliation context.
- Administrators manage default and per-agent pricing.
- Agent management includes suspension, recovery, sales, wallet, and pricing.
- No internal role can impersonate an agent or directly edit a wallet balance.
- Order investigation connects payment, inventory, delivery, wallet, refund,
  replacement, and dispute history.
- Voucher values are masked by default.
- Administrator reveal requires step-up confirmation, a reason, and audit.
- Work queues cover exceptions, withdrawals, delivery, disputes, refunds, and
  reconciliation.
- Support receives masked investigation and complaint-intake tools only.
- Authorized Administrators can search immutable audit history.
- Administration exports are purpose-specific, privacy-safe, expiring, and
  audited.
- Raw SQL, arbitrary ledger entries, bulk raw-voucher export, and unaudited
  mutations are prohibited.

## Open after Topic 10

1. What low-stock threshold should each checker product start with?
2. How long should generated administration exports remain downloadable?

Administrator step-up uses a fresh user-verified passkey assertion under
[ADR-0011](../decisions/ADR-0011-use-passkeys-for-internal-authentication.md).

Operational and reconciliation queue items are assignable to specific
operators.

## Resolved in Topic 11 — Reporting and reconciliation

- Timestamps are stored in UTC and reports use `Africa/Accra`.
- Today, 7-day, 30-day, and lifetime periods use confirmed calendar boundaries.
- Gross sales is successful-order retail value before refunds.
- Net sales is gross sales minus completed refunds.
- Agent earnings derive from sale credits minus reversal debits.
- Positive wallet liability and negative agent debt are reported separately.
- Gross base-price revenue derives from immutable order snapshots.
- Realized contribution subtracts actual allocated acquisition and provider
  costs.
- Continuous checks and formal daily reconciliation are both required.
- Payment, inventory, wallet, withdrawal, refund, settlement, and delivery costs
  are reconciled.
- Discrepancies become assigned evidence-backed cases.
- Source records are not edited to force reconciliation.
- Closed run inputs and results are immutable.
- Late events use adjustment runs or linked discrepancy resolution.
- Agent and administration reports share canonical source records and metric
  definitions.

## Resolved in Topic 12 — Security, privacy, and compliance baseline

- Agent balances are restricted earnings ledgers, not general-purpose wallets.
- Top-ups, deposits, transfers, interest, and internal spending are prohibited.
- Data Protection Commission registration is a production launch gate.
- Doraf assigns data-protection responsibility and maintains processing records.
- Agents and guest buyers receive plain-language privacy notices.
- Every personal-data field needs a purpose and lawful basis.
- Ordinary product flows avoid student exam data and age.
- Provider contracts, data locations, and cross-border processing are reviewed.
- Data-subject procedures and category-specific retention are required.
- Doraf maintains incident and breach-response procedures.
- Internal operators use stronger authentication than agent SMS OTP.
- Voucher and sensitive personal data encryption use separated keys and audited
  access.
- Provider webhooks, credentials, environments, and money movement are
  isolated and protected.
- Bank of Ghana classification, Paystack onboarding, WAEC authorization, tax,
  accounting, provider contracts, minors, and consumer obligations are launch
  gates.

## Resolved in Topic 13 — MVP boundary and delivery phases

- The MVP includes the full controlled sale, fulfillment, ledger, withdrawal,
  dispute, reporting, administration, and compliance lifecycle.
- Operational and exception paths are required MVP behavior.
- Business agents, teams, buyer accounts, KYC, bank payouts, wallet expansion,
  merchandising extensions, native apps, and additional gateways are excluded.
- Delivery proceeds through external readiness, foundation, supply and catalog,
  web sales, exceptions, agent finance, USSD, operations, and launch readiness.
- External and compliance work may overlap engineering.
- Production remains blocked until every applicable launch gate is complete.

## Resolved in Topic 14 — System architecture

- Doraf starts as a modular monolith.
- Agent web, administration web, API, and worker are separate deployables.
- NestJS domain modules own business rules.
- Next.js applications do not calculate authoritative money or inventory state.
- PostgreSQL is the canonical source of truth.
- Prisma manages schema, migrations, and typed database access.
- Critical invariants use short PostgreSQL transactions and constraints.
- Asynchronous work uses a transactional outbox and durable at-least-once queue.
- API and worker processes scale independently.
- Providers are isolated behind Doraf-owned adapters.
- Complaint evidence and exports use private object storage.
- Voucher encryption is a dedicated boundary.
- Tenant-scoped repositories and database tests protect isolation.
- REST and provider-specific endpoints expose explicit contracts, not ORM
  entities.
- A safe shared contracts package may serve the two web applications.
- Microservice extraction requires demonstrated need.

## Open after Topic 14

1. Which SMS provider and implementation will support confirmed agent OTP
   authentication?
2. Which SMS, email, and USSD providers will be selected?

## Resolved in Topic 15 — Logical data model and states

- Internal IDs are non-sequential UUIDs.
- Buyer order references are separate high-entropy values.
- Money is integer pesewas in GHS and timestamps are UTC.
- One immutable order item represents each purchased voucher unit.
- Inventory allocation, SMS, dispute, replacement, and unit refund link to the
  relevant order item.
- Payment, inventory, fulfillment, delivery, refund, dispute, and withdrawal
  states remain separate dimensions.
- Provider states are normalized at adapter boundaries while raw event history
  remains append-only.
- Order acceptance distinguishes one fulfilling payment from excess successful
  attempts.
- Voucher ciphertext and duplicate fingerprints are separate.
- Wallet balance derives from append-only entries; holds are explicit.
- Audit, outbox, idempotency, reconciliation, and export records are first-class
  entities.
- Financial, inventory, audit, provider, and closed reconciliation history is
  not physically deleted through product workflows.

## Resolved in Topic 16 — Physical schema plan

- PostgreSQL uses UUID internal IDs, `timestamptz`, and `bigint` minor units.
- Public and provider references remain separate from internal IDs.
- Sensitive values use ciphertext plus key metadata and safe masks.
- Lookup and duplicate detection use keyed HMAC fingerprints, not plain hashes.
- Prisma expresses ordinary models, relations, indexes, and constraints.
- Reviewed migration SQL implements checks, partial indexes, exclusion rules,
  append-only protection, and locking behavior Prisma cannot fully express.
- Critical unique and partial constraints cover channels, pricing, reservations,
  allocation, payment attempts, ledger sources, holds, delivery, and refunds.
- High-contention inventory and wallet transactions use explicit locking or
  selective serializable isolation with bounded database retries.
- Database tests run against real PostgreSQL with production migrations.
- Migration order follows foundation, identity, catalog, inventory, orders,
  fulfillment, ledger, disputes, operations, and reconciliation.
- Seed creates the three stable products without inventing commercial prices.
- `pg-boss` was initially selected but is superseded for the hosted deployment
  by Cloud Tasks and Pub/Sub under ADR-0010.

## Resolved in Topic 17 — Infrastructure and recovery

- AWS is the MVP production cloud.
- Production runs in `af-south-1` across at least two Availability Zones.
- `eu-west-1` is the recovery Region, subject to launch-time service and
  replication validation.
- ECS/Fargate runs agent web, administration web, API, and worker as separate
  services.
- RDS for PostgreSQL is encrypted, private, Multi-AZ, deletion-protected, and
  configured for 35-day point-in-time recovery.
- S3 stores private evidence, exports, and security archives with versioning,
  Block Public Access, lifecycle rules, and SSE-KMS.
- Customer-managed KMS keys protect purpose-separated data; Secrets Manager
  stores application and provider secrets.
- Voucher values use application envelope encryption, and the duplicate HMAC
  key remains separate.
- CloudWatch, CloudTrail, and OpenTelemetry provide safe logs, metrics, traces,
  audit visibility, and alerts.
- AWS accounts separate production, non-production, and security/log archives.
- AWS CDK in TypeScript defines infrastructure.
- Complete Region loss targets a 30-minute RPO and four-hour RTO.
- Restore testing is quarterly; cross-Region recovery is tested before launch
  and at least twice yearly.
- AWS region choice does not remove Ghanaian cross-border privacy obligations.

## Open after Topic 17

1. Which SMS provider and implementation will support confirmed agent OTP
   authentication?
2. Which SMS, email, and USSD providers will be selected?
3. What exact retention periods will legal and accounting review approve?

## Resolved in Topic 18 — Lean hosted infrastructure

- Supabase provides PostgreSQL only; Supabase Auth, Storage, Functions, and
  other application services are not used.
- Supabase Free is restricted to development and closed no-stakes pilots.
- Supabase Pro, currently $25 monthly, is the minimum meaningful live tier.
- Google Cloud Run hosts web applications, API, and asynchronous handlers.
- Cloud Tasks, Pub/Sub, Cloud Scheduler, and Cloud Run Jobs replace a
  permanently polling `pg-boss` worker.
- The transactional outbox remains the durable business intent.
- Google Secret Manager stores provider and application secrets.
- The application-held voucher master key protects voucher envelope-encryption
  keys under ADR-0012; evidence key management remains to be finalized.
- Cloud Logging stores redacted operational telemetry; PostgreSQL remains the
  durable business audit source.
- Google Cloud Storage uses private buckets, least-privilege IAM, short-lived
  signed URLs, quarantine, malware scanning, and separate object recovery.
- The expected closed-pilot infrastructure cost is $0–$2 monthly.
- The expected small live infrastructure cost is $25–$30 monthly before
  transaction, messaging, USSD, domain, and inventory costs.

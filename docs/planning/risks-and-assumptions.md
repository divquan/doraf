# Risks and assumptions

Status: Active  
Last updated: 2026-07-30

## Assumptions to validate

| ID | Assumption | Why it matters |
| --- | --- | --- |
| A-001 | Authorized vendors permit the platform to resell and electronically distribute the PINs. | Determines whether the business and fulfillment model is viable. |
| A-002 | Each serial-number/PIN pair supplied by a vendor is unique within Doraf's inventory. | Drives duplicate detection and allocation safety. |
| A-003 | Mobile Money providers or an aggregator expose reliable asynchronous payment confirmation. | Drives the order state machine and fulfillment trigger. |
| A-004 | SMS is an acceptable primary delivery channel for the complete PIN. | Affects privacy, security, cost, and recovery flows. |
| A-005 | An agent's profit can be calculated deterministically when an order is placed. | Required for ledger entries and reconciliation. |
| A-006 | A personalized USSD identifier can reliably preserve agent attribution. | Required for USSD channel design and provider selection. |

## Initial risks

| ID | Risk | Consequence | Direction to investigate |
| --- | --- | --- | --- |
| R-001 | Concurrent orders allocate the same PIN. | Financial loss and failed customer fulfillment. | Atomic reservation and a database uniqueness invariant. |
| R-002 | Forged, delayed, or repeated payment callbacks trigger fulfillment more than once. | PIN leakage and incorrect wallet credits. | Verified callbacks, idempotency keys, and explicit order states. |
| R-003 | Mobile Money payments are later reversed after earnings become withdrawable. | The platform carries negative settlement exposure. | Define holds, reserves, reversal recovery, and withdrawal rules. |
| R-004 | SMS delivery fails after a PIN is consumed from inventory. | Buyer has paid but cannot access the product. | Durable delivery attempts and a secure retrieval/support path. |
| R-005 | Operators or database readers can view or export unused PINs. | Theft of the platform's primary inventory asset. | Encryption, strict access, masking, and audit logs. |
| R-006 | Agents set misleading or exploitative prices. | Buyer harm and reputational or regulatory exposure. | Price floors, ceilings, and clear buyer disclosure. |
| R-007 | Incorrect agent attribution redirects earnings. | Financial disputes and loss of agent trust. | Immutable attribution on order creation and channel uniqueness. |
| R-008 | Manual balance edits make reconciliation impossible. | Financial reporting and fraud-control failures. | Immutable double-entry or transaction-ledger approach. |
| R-009 | USSD sessions time out during payment or fulfillment. | Ambiguous orders and poor buyer experience. | Decouple session progress from asynchronous fulfillment. |
| R-010 | Applicable Ghanaian payments, consumer, tax, privacy, or identity rules are missed. | Regulatory and launch risk. | Obtain qualified local legal and compliance review. |
| R-011 | Registration without identity verification enables duplicate, abusive, or fraudulent agent accounts. | Fraud, support burden, and withdrawal losses. | Verify phone ownership, apply operational controls, and retain the option to suspend accounts. |
| R-012 | A phone number is recycled or transferred to a new owner. | Unauthorized access to an agent account and its wallet. | Define account recovery, re-verification, and sensitive-action controls. |
| R-013 | Manual recovery is socially engineered or performed incorrectly. | An attacker gains access to sales data and withdrawable funds. | Require documented evidence, audited actions, and explicit approval rules. |
| R-014 | A buyer mistypes the same incorrect delivery number twice. | A paid PIN is delivered to the wrong person. | Show a clear final confirmation and define a support policy for misdirected delivery. |
| R-015 | Administrator permissions are concentrated in a small MVP team. | One compromised or malicious account can expose inventory or move money. | Require strong authentication, least-privilege interfaces, alerts, and comprehensive audit records. |
| R-016 | Order references can be guessed during buyer PIN recovery. | PINs and buyer information are disclosed. | Use high-entropy references, phone verification, rate limits, and generic error responses. |
| R-017 | A price changes while a buyer is checking out. | The charged amount, displayed amount, and agent profit disagree. | Create and persist one immutable order-price snapshot before payment starts. |
| R-018 | A per-agent override is configured incorrectly. | Doraf loses margin or the agent cannot sell. | Validate bounds, show effective-price previews, require a reason, and audit changes. |
| R-019 | Operating costs exceed the allowance included in the base price. | Doraf loses money even when the configured margin appears positive. | Track realized provider and delivery costs and review base prices operationally. |
| R-020 | A voucher is assigned to the wrong checker product during import. | The buyer pays for credentials that cannot open the intended result type. | Import by product-specific batch, validate classification, and clearly display product scope. |
| R-021 | Leading zeroes are lost from a 12-digit PIN. | A valid voucher becomes unusable. | Treat PINs as fixed-length strings at every boundary. |
| R-022 | A serial number and PIN become mismatched. | The delivered pair fails on the WAEC portal. | Model, import, allocate, and deliver them as one inseparable item. |
| R-023 | Buyers assume three uses can be shared between candidates. | Failed checks, disputes, and replacement demands. | Disclose the candidate-and-year lock before payment and in delivery messages. |
| R-024 | A synthetic email containing a payer phone number leaks through logs, dashboards, or exports. | Personal data is exposed beyond its intended use. | Treat it as personal data, mask it, restrict access, and avoid ordinary logs. |
| R-025 | The synthetic-email domain receives messages or is later assigned to real mailboxes. | Paystack or customer information reaches an unintended recipient. | Use a controlled guest subdomain with an explicit inbound-mail policy. |
| R-026 | The payer phone number is normalized inconsistently. | One payer produces multiple Paystack customer identities or malformed emails. | Define one canonical Ghana/international digits-only representation. |
| R-027 | The optional delivery email is confused with Paystack's synthetic email. | Vouchers are misdelivered or provider metadata is treated as buyer contact information. | Use separate explicitly named fields and never substitute one for the other. |
| R-028 | A buyer mistypes an optional delivery email. | Voucher secrets are disclosed to the wrong recipient. | Confirm the address in checkout and define correction and support rules. |
| R-029 | An invalid row causes an otherwise large inventory batch to fail. | Inventory availability is delayed. | Provide precise row-level validation errors and a safe retry workflow. |
| R-030 | A repeated webhook or verification response credits an agent twice. | Doraf overstates liabilities and may pay out unearned funds. | Use idempotent payment processing and a unique sale-credit ledger key per order. |
| R-031 | External delivery is called before the commercial transaction commits. | A buyer receives a voucher for an order that is not durably paid or sold. | Persist delivery work atomically and call providers asynchronously after commit. |
| R-032 | An old failed order retains a favorable price indefinitely. | A buyer bypasses later base-price changes. | Define a payment retry and order-price expiry window. |
| R-033 | Multiple payment attempts for one order succeed. | The buyer is charged more than once. | Block concurrent active attempts, verify terminal state before retry, and reconcile unexpected duplicate success. |
| R-034 | A buyer mistypes an agent referral code. | The wrong agent receives attribution and profit. | Show agent identity before confirmation and snapshot attribution on the order. |
| R-035 | A retired agent code is assigned to someone else. | Old marketing material redirects sales to a different agent. | Prefer permanent code retirement rather than reassignment. |
| R-036 | Fulfillment depends on the USSD session remaining open. | A timed-out session interrupts a paid order. | End the channel interaction after payment initiation and complete asynchronously. |
| R-037 | Repeated USSD requests create multiple orders or payment attempts. | Duplicate prompts, reservations, or charges occur. | Persist provider session/request identifiers and make each transition idempotent. |
| R-038 | A payment reverses after the agent has withdrawn the sale profit. | The platform temporarily carries the loss and the agent owes a negative balance. | Append a reversal debit, block further withdrawals, offset future credits, and define collection or suspension thresholds. |
| R-039 | The same reversal event is processed more than once. | The agent is debited repeatedly for one reversed payment. | Use the provider reversal identifier and original sale credit as idempotency constraints. |
| R-040 | Background reconciliation finds success after inventory was released. | Doraf has collected money without guaranteed stock. | Allocate fresh inventory atomically or route the paid order to Administrator refund. |
| R-041 | A stale order preserves an old favorable price. | Buyers bypass a later pricing policy. | Expire new payment attempts 15 minutes after order confirmation. |
| R-042 | A duplicate payment is accidentally treated as another sale. | Inventory and agent profit are issued without another buyer order. | Model excess payments explicitly and refund them without fulfillment or wallet credit. |
| R-043 | Concurrent withdrawal requests spend the same balance. | Doraf pays more than it owes the agent. | Atomically place holds and derive withdrawable funds after all active holds. |
| R-044 | Paystack transfer credentials are compromised. | An attacker sends Doraf's provider balance to unauthorized recipients. | Restrict payout destinations, retain merchant OTP, protect keys, use unique references, and alert on transfers. |
| R-045 | A transfer remains pending while the agent expects funds. | Support disputes and accidental duplicate payout attempts occur. | Keep the hold, display pending status, reconcile with Paystack, and never create a replacement transfer without a terminal result. |
| R-046 | Provider fees or limits change. | Requests fail or Doraf and agent balances become inconsistent. | Keep constraints configurable and verify current Paystack terms operationally. |
| R-047 | A registered agent phone number is incorrect or recycled. | Withdrawal is paid to the wrong person. | Use fresh OTP, manual recovery for phone changes, masked confirmation, and restricted destinations. |
| R-048 | A timed-out delivery request actually reached the provider. | Blind retry sends duplicate voucher messages. | Reconcile accepted or unknown provider requests before resubmission. |
| R-049 | Recovery endpoints allow order enumeration. | Attackers discover orders or trigger OTP harassment. | Use high-entropy references, generic responses, and rate limits. |
| R-050 | Encryption keys for retained voucher secrets are compromised. | Unused and sold voucher credentials are exposed. | Separate keys from data, restrict decryption, rotate keys, audit access, and design incident response. |
| R-051 | Multi-voucher delivery partially succeeds. | Buyer receives only part of a paid order and Support sees an ambiguous overall status. | Track delivery per voucher and channel while preserving the order-level purchased quantity. |
| R-052 | A buyer falsely claims an unused voucher was already used. | Doraf loses replacement inventory or refund value. | Require evidence, check dispute history, limit standard replacement, and use Administrator review. |
| R-053 | Complaint evidence contains student personal information. | Doraf collects sensitive data beyond the sales purpose. | Request minimal evidence, support redaction, restrict access, and define retention. |
| R-054 | A partial refund reverses the wrong amount of agent profit. | Wallet and payment reconciliation diverge. | Use immutable per-unit price and profit snapshots with idempotent linked entries. |
| R-055 | Replaced inventory is accidentally returned to sale. | Another buyer receives a disputed or exposed voucher. | Preserve sold allocation and use terminal replacement/refund dispositions. |
| R-056 | Agent reports expose buyer or payer contact details. | Agents obtain personal data unnecessary for resale operations. | Mask delivery numbers and exclude payer numbers, emails, and secrets from views and exports. |
| R-057 | A sales-channel code is reassigned. | Old marketing material credits a different agent. | Make referral codes permanent and never reassign retired values. |
| R-058 | An export bypasses portal masking rules. | Large-scale buyer, wallet, or commercial data leakage occurs. | Use dedicated privacy-safe export schemas, authorization, expiry, and audit. |
| R-059 | Dashboard totals disagree with ledger or orders. | Agents lose trust and support cannot explain earnings. | Define metric sources and period boundaries and reconcile summaries to immutable records. |
| R-060 | An internal portal becomes a generic data editor. | Operators bypass domain invariants and destroy auditability. | Provide purpose-built commands and prohibit raw SQL, balance editing, and silent mutation. |
| R-061 | An Administrator casually reveals voucher secrets. | Inventory or purchased credentials are stolen. | Mask by default and require step-up confirmation, a reason, narrow scope, and audit. |
| R-062 | Administration exports aggregate excessive sensitive data. | One downloaded file causes a large breach. | Use purpose-specific schemas, least privilege, expiry, encryption, and audit. |
| R-063 | Operational exceptions are visible but unowned. | Paid orders, withdrawals, or disputes remain unresolved. | Define queue assignment, age indicators, alerts, and service-level expectations. |
| R-064 | Negative agent balances are netted against positive wallets. | Doraf understates money owed to agents and hides debt exposure. | Report positive liability and negative agent debt separately. |
| R-065 | Closed reports change when late callbacks arrive. | Finance cannot reproduce prior daily totals. | Keep closed runs immutable and use adjustment runs or discrepancy resolution. |
| R-066 | Cached dashboard projections become the financial source of truth. | Rebuilds and reconciliation produce different totals. | Derive all projections from canonical orders, item transitions, provider records, and ledger entries. |
| R-067 | Provider costs are estimated rather than matched to actual activity. | Doraf overstates realized contribution. | Reconcile actual payment, transfer, SMS, and email fees to their source records. |
| R-068 | Product language or behavior makes the earnings ledger resemble a general-purpose wallet. | Doraf expands regulatory scope unintentionally. | Prohibit top-ups, deposits, spending, interest, transfers, and third-party payout destinations. |
| R-069 | Doraf launches without required data-controller readiness. | Regulatory action, blocked operations, and loss of trust. | Treat DPC registration, notices, processor terms, retention, rights, and breach procedures as launch gates. |
| R-070 | Using a licensed PSP is incorrectly assumed to settle Doraf's own regulatory status. | Doraf operates under the wrong authorization model. | Obtain qualified Ghanaian advice and, where appropriate, Bank of Ghana confirmation. |
| R-071 | Production credentials are available in test or preview environments. | Tests create real charges, refunds, or transfers. | Isolate credentials and technically prevent non-production money movement. |
| R-072 | A provider processes personal data in an unknown location or subprocessor. | Doraf cannot meet transparency, security, or cross-border obligations. | Maintain provider records, contracts, data maps, and periodic review. |
| R-073 | Complaint handling unnecessarily collects information about minors. | Doraf increases privacy and safeguarding exposure. | Avoid student data in normal flows, minimize evidence, and complete qualified minor-related review. |
| R-074 | The happy path is labeled MVP while operational controls are postponed. | Real payments or vouchers fail without recovery, reconciliation, or audit. | Treat exceptions, administration, security, and reconciliation as part of MVP completion. |
| R-075 | Engineering commits to a provider-dependent design before confirming feasibility. | USSD, payment, delivery, or payout behavior requires major rework. | Run external readiness and sandbox validation early and track provider gates. |
| R-076 | Compliance work begins only after implementation. | Launch is delayed or the product model must change late. | Run regulatory, privacy, vendor, tax, and contract work alongside engineering. |
| R-077 | Later-scope features leak into the MVP. | Delivery slows and security-critical work is displaced. | Maintain explicit included and excluded scope and require a recorded scope decision for changes. |
| R-078 | Premature microservices split one financial transaction across systems. | Payment, inventory, and wallet state diverge under failure. | Start with a modular monolith and extract only from measured need. |
| R-079 | A database commit succeeds but follow-up delivery work is lost. | Paid buyers receive no voucher and no retry exists. | Write transactional outbox intent in the same commit and monitor dispatch. |
| R-080 | Queue delivery is assumed to be exactly once. | Repeated jobs duplicate provider calls or financial effects. | Assume at-least-once delivery and require idempotent handlers and reconciliation. |
| R-081 | Client applications calculate authoritative price or balance. | UI and API disagree and buyers or agents see invalid money values. | Keep calculations and authorization in API domains and expose explicit contracts. |
| R-082 | ORM types leak directly into public APIs. | Schema changes expose sensitive fields or break clients unpredictably. | Use validated purpose-specific contracts and keep internal entities API-only. |
| R-083 | A multi-voucher order stores only a quantity and opaque arrays. | Partial delivery, replacement, and refund cannot be constrained or reconciled. | Create one order item per voucher unit with immutable unit pricing. |
| R-084 | One overloaded order status hides independent outcomes. | Operations cannot distinguish paid, allocated, delivered, disputed, and refunded state. | Maintain separate state machines and derive user-facing status projections. |
| R-085 | Provider status values are stored as the domain state directly. | Provider changes leak into business rules and cross-provider behavior diverges. | Normalize at adapters and retain append-only provider events. |
| R-086 | Public references reuse sequential database IDs. | Buyers or attackers enumerate orders and recovery targets. | Use separate high-entropy public references and generic recovery responses. |
| R-087 | Plain hashes protect phone numbers or 12-digit PINs. | An attacker brute-forces the small input space offline. | Use keyed HMAC fingerprints with a separately managed key plus encryption for recovery. |
| R-088 | Business invariants exist only in Prisma or UI validation. | Concurrent or alternative write paths create invalid financial state. | Add PostgreSQL checks, partial uniqueness, append-only protection, and real database tests. |
| R-089 | Serializable transactions retry external provider calls. | A database conflict creates duplicate charges, messages, or transfers. | Keep external calls outside transactions and retry only fresh internal database work. |
| R-090 | PostgreSQL job load starves transactional checkout connections. | Payments and webhooks slow or fail during worker spikes. | Use separate pools, queue concurrency limits, backpressure, monitoring, and extraction thresholds. |
| R-091 | Queue payloads contain voucher secrets or excessive personal data. | Queue inspection or backup exposes sensitive values. | Send identifiers and routing metadata only; reload protected canonical state in workers. |
| R-092 | Cape Town latency or routing from Ghana is worse than expected. | Checkout, administration, and provider callbacks are slow. | Test Ghanaian networks and provider paths before launch; retain an ADR-controlled primary-Region fallback. |
| R-093 | Cross-border cloud processing is undocumented or impermissible. | Doraf breaches privacy obligations or cannot launch. | Complete DPC/legal review, processor terms, data mapping, notices, and transfer safeguards. |
| R-094 | A regional outage outlasts the recovery objective. | Payments and voucher delivery remain unavailable. | Replicate backups, keep recovery infrastructure in code, test failover, and measure achieved RPO/RTO. |
| R-095 | An operator disables or deletes a KMS key. | Vouchers, backups, evidence, or secrets become unreadable. | Separate roles, enable deletion waiting periods, alert on key changes, and test key-dependent recovery. |
| R-096 | Logs or traces capture voucher or personal data. | Central observability becomes a high-volume disclosure source. | Use allowlisted structured fields, redaction tests, sampling controls, and restricted retention/access. |
| R-097 | Backup existence is mistaken for recoverability. | Recovery fails during an actual incident. | Perform scheduled isolated restores and cross-Region exercises with measured RPO/RTO. |
| R-098 | One AWS account or shared credential compromises every environment. | An attacker reaches production data and weakens evidence. | Separate accounts, federated short-lived access, least privilege, CloudTrail, and a security archive. |
| R-099 | Infrastructure cost grows without ownership. | MVP economics deteriorate or controls are disabled to save money. | Tag resources, set budgets and anomaly alerts, review unit costs, and right-size from measured load. |
| R-100 | Supabase Free pauses or is treated as a production database. | Payment callbacks, delivery, and withdrawals fail or data is unavailable. | Restrict Free to no-stakes pilots and require Pro before meaningful live payments. |
| R-101 | A Supabase database backup is assumed to include Google Cloud Storage objects. | Dispute evidence or exports cannot be recovered. | Back up or replicate objects separately and test object restoration. |
| R-102 | Google compute is far from the Supabase project Region. | Every transactional request has high and variable database latency. | Place compute near the selected database Region and validate both Ghana-user and database paths. |
| R-103 | Daily Supabase backups are assumed to meet a low RPO. | Up to a day of financial and inventory data may be lost. | Add frequent encrypted logical backups, reconcile providers, test recovery, and adopt PITR when justified. |

# Platform brief

Status: Confirmed MVP scope
Last updated: 2026-08-01

## Product summary

Doraf is a B2B2C marketplace through which people in Ghana can resell digital
WAEC result-checking PINs for a profit.

The platform operates as a multi-tenant agent system. An agent signs up, sets a
retail price, and distributes personalized sales channels to prospective
buyers. The MVP sales channel is a permanent personalized web link. USSD is
deferred until after the MVP.

When a buyer purchases through an agent's channel:

1. The buyer initiates and completes a Mobile Money payment.
2. The platform selects an unused PIN from centrally held inventory.
3. The platform delivers the PIN to the buyer by SMS.
4. The platform credits the agent's profit margin to the agent's withdrawable
   wallet balance.

## Confirmed constraints

### PF-001 — Central inventory

All PIN inventory is sourced by the platform. Agents do not supply, upload, or
own inventory.

### PF-002 — Authorized sourcing

The platform buys PINs in bulk from authorized WAEC vendors and pre-loads them
into its database.

### PF-003 — Agent-controlled retail pricing

Agents can set their own retail prices.

The permitted pricing range, price-change rules, and treatment of fees are not
yet defined.

### PF-004 — Agent-attributed sales channels

Each agent can distribute one permanent personalized web sales link. Purchases
through that link must be attributed to the correct active agent.

### PF-005 — Mobile Money collection

Buyers pay using Mobile Money.

Supported providers, payment initiation methods, fees, timeouts, reversals, and
reconciliation behavior are not yet defined.

### PF-006 — Automated fulfillment

After a successful purchase, the system automatically allocates an unused PIN
and delivers it to the buyer through SMS.

The precise point at which a payment is considered successful and the recovery
path for failed SMS delivery remain open.

### PF-007 — Immediate agent earnings

After a successful purchase, the agent's profit margin is immediately credited
to the agent's withdrawable wallet balance.

The definitions of "successful purchase," "profit margin," and "immediately
withdrawable" require business-rule decisions, especially for payment
reversals and fraud risk.

### PF-008 — Individual agents

Only individuals may register as agents in the MVP. Business and organization
agent accounts are outside the MVP.

### PF-009 — Minimal agent registration

An agent registers with a name and phone number. Identity documents, email
addresses, and business details are not required.

### PF-010 — No agent identity verification in the MVP

The MVP does not require identity verification before an agent can sell or
withdraw.

This is a confirmed product requirement, but applicable provider, payment,
telecommunications, and regulatory obligations still need to be validated.

### PF-011 — One user per agent tenant

Each agent tenant has exactly one user. Staff invitations, delegated access,
and agent team roles are outside the MVP.

### PF-012 — Guest buyer checkout

Buyers can purchase without creating a platform account.

### PF-013 — Independent payer and delivery numbers

The phone number receiving the PIN may differ from the Mobile Money number used
to pay. An order must preserve both numbers when they differ.

### PF-014 — Agent authentication

An agent signs in using their phone number and an SMS one-time password. Agents
do not create a reusable password or sign-in PIN in the MVP.

### PF-015 — Unique agent phone number

A phone number can be associated with only one agent account.

### PF-016 — Manual account recovery

An Administrator handles agent account recovery manually during the MVP when
an agent loses access to their registered phone number.

The evidence and approval required for recovery still need to be defined.

### PF-017 — Suspended agent access

A suspended agent may sign in with read-only access to their historical sales.
They cannot receive new sales. Withdrawal of an existing balance requires an
administrator's decision.

### PF-018 — Delivery number confirmation

A guest buyer confirms the PIN delivery number by entering it twice. The
platform does not send an OTP to the delivery number before payment in the MVP.

### PF-019 — Internal platform roles

The MVP has two internal roles: Administrator and Support. Their permissions
must be enforced independently of the agent tenant model.

### PF-020 — No agent impersonation

Internal users cannot impersonate an agent. Support and administration are
performed through dedicated, audited internal tools.

### PF-021 — Audited sensitive operations

Every sensitive administrative action records the operator, timestamp, reason,
action, and affected record.

### PF-022 — Withdrawal step-up authentication

An agent must complete a fresh SMS OTP challenge when requesting a withdrawal.

### PF-023 — Manual recovery control

An Administrator performs agent account recovery. The operation requires a
documented reason and successful OTP verification of the replacement phone
number.

### PF-024 — Buyer PIN recovery

A buyer can recover a previously purchased PIN using the order reference and
successful verification of the delivery phone number.

### PF-025 — Platform base price

The platform defines a base price for each PIN product. The base price includes
the platform's inventory acquisition cost, operating costs, and platform
margin.

### PF-026 — Agent retail price

An agent selects a retail price at or above the effective base price and at or
below the effective retail-price maximum. Each agent has one active retail
price per PIN product across the web channel.

### PF-027 — Agent profit

Agent profit for an order is:

`retail price - effective base price`

### PF-028 — Buyer-facing price

The buyer sees and pays one final retail price. Payment-processing, SMS, and
other platform fees are not added at checkout in the MVP.

### PF-029 — Immutable order pricing

An order stores snapshots of its base price, retail price, and agent profit.
Later changes to platform or agent pricing do not change an existing order.

### PF-030 — Price precision

Prices are denominated in Ghana cedis with two-decimal precision.

Implementations should represent monetary values in integer pesewas rather than
binary floating-point values.

### PF-031 — Per-agent pricing adjustments

An Administrator can configure agent-specific base-price and retail-maximum
overrides. An agent-specific value takes precedence over the corresponding
product default.

The Support role remains read-only and cannot change pricing.

### PF-032 — Pricing-policy changes

A new price affects only orders created after the change. If an effective base
price rises above an agent's active retail price, the active retail price is
moved to the new base price. If an effective retail maximum falls below the
active retail price, the active retail price is moved down to the new maximum.

The system must reject any pricing policy whose maximum is below its base price.

### PF-033 — Three WAEC checker products

Doraf sells three distinct products:

1. BECE Checker
2. WASSCE Checker
3. NOV/DEC (Private) Checker

The products are not interchangeable.

### PF-034 — Checker product scope

- A BECE Checker supports BECE School and BECE Private results across all
  examination years.
- A WASSCE Checker supports WASSCE School results across all examination years.
- A NOV/DEC (Private) Checker supports WASSCE Private, ABCE, and GBCE results
  across all examination years.

### PF-035 — Voucher fields

One inventory item, also called a WAEC Checker or voucher, contains exactly:

- one alphanumeric serial number, and
- one 12-digit PIN.

The serial number and PIN form one inseparable inventory item and must be
delivered together.

### PF-036 — Multiple vouchers per order

A buyer can purchase multiple vouchers in one order.

Whether an order can mix different checker products and the maximum quantity
per order remain open.

### PF-037 — No calendar expiration

An unused voucher has no known time-based expiration. Inventory does not become
unsellable merely because time has passed.

### PF-038 — WAEC usage restrictions after sale

Each voucher:

- permits exactly three result checks,
- becomes locked to the candidate's Index Number and Examination Year after its
  first use,
- cannot then be transferred to another candidate, and
- works only for the examination types supported by its checker product.

Doraf sells unused vouchers. It does not currently receive usage information
from the WAEC result portal and therefore cannot track the remaining checks
after a voucher is sold.

### PF-039 — Synthetic Paystack customer email

Guest buyers are not required to provide an email address. When Paystack
requires an email, Doraf generates a synthetic email from the normalized Mobile
Money payer number under a merchant-controlled guest subdomain.

The generated value is stored with the payment attempt and sent to Paystack. It
is integration metadata, not a buyer-provided or contactable email address.

### PF-040 — Optional email delivery

SMS delivery to one confirmed phone number remains required for every order. A
buyer may optionally provide an email address and receive the same purchased
voucher details there as a second delivery channel.

The buyer-provided delivery email is distinct from the synthetic Paystack email
and is not used in Paystack's email field.

### PF-041 — MVP order composition

An order contains between one and five vouchers of exactly one checker product.
All vouchers in the order use the same required SMS delivery number and, when
provided, the same optional delivery email.

### PF-042 — Product-specific inventory batches

An Administrator imports vouchers in product-specific CSV batches. Doraf
records the vendor, vendor invoice or reference, acquisition date, unit cost,
uploader, and import timestamp.

The complete batch is validated before import. Any invalid or duplicate row
rejects the entire batch and produces row-level errors.

### PF-043 — Pre-payment inventory reservation

Doraf reserves the complete voucher quantity immediately before initiating
Paystack payment. The reservation covers Paystack's 180-second Mobile Money
authorization window.

When a success webhook has not arrived at the end of the window, Doraf verifies
the transaction with Paystack before releasing inventory. A non-terminal
provider result retains the reservation for a short, configurable
reconciliation grace period.

### PF-044 — Sold inventory is final

A sold voucher never returns to available inventory, including when SMS or
optional email delivery fails.

### PF-045 — Web checkout inputs

Web checkout collects:

- one checker product,
- a quantity from one to five,
- the required delivery phone number entered twice,
- an optional delivery email entered twice,
- the Mobile Money payer number, and
- the payer's Mobile Money network.

Before confirmation, checkout displays the product scope, quantity, final price,
delivery destinations, and WAEC usage restrictions.

### PF-046 — Immutable confirmed order

Buyer confirmation creates an order with agent attribution, product, quantity,
unit and total pricing snapshots, delivery details, and payer details. The
agent, product, quantity, and pricing snapshot are immutable.

After successful payment, delivery and payer details also cannot be changed.
Whether an unpaid order's delivery or payer details can be corrected remains
open.

### PF-047 — Exactly-once payment effects

A verified successful payment causes Doraf to:

- mark the payment attempt successful,
- mark the order paid,
- convert the order's reserved vouchers to sold,
- create the agent wallet credit exactly once, and
- enqueue SMS and optional email delivery.

These effects must be idempotent when Paystack callbacks or verification results
are repeated.

### PF-048 — Earnings do not depend on notification delivery

Agent earnings are credited after confirmed payment and successful voucher
allocation. SMS or email delivery failure does not reverse the sale or agent
credit.

### PF-049 — Retrying a failed payment

After a terminal payment failure, Doraf releases the reservation. The buyer may
retry payment for the same order using a new payment attempt, unique Paystack
reference, and fresh inventory reservation.

The time for which the order's original pricing snapshot remains payable is
still to be defined.

### PF-050 through PF-054 — USSD purchase

Deferred until after the MVP by product-owner decision on 2026-08-01. These
requirements are retained as post-MVP discovery history and are not launch
criteria.

### PF-055 — Payment reversal to agent wallet

If a payment is reversed after Doraf credited the sale profit, Doraf appends an
equal reversal debit to the agent's wallet ledger. The original sale credit is
not edited or deleted.

The agent's wallet balance may become negative. Future earnings offset the
negative balance, and no funds are withdrawable until the resulting balance is
positive.

### PF-056 — Order payment window

An unpaid order retains its pricing snapshot and accepts new payment attempts
for 15 minutes after buyer confirmation. It permits at most three payment
attempts, with only one active attempt at a time.

Expiry prevents a new attempt but does not invalidate an attempt that was
already active before the deadline.

### PF-057 — Payment reconciliation grace period

When no webhook arrives during Paystack's 180-second authorization window,
Doraf verifies the transaction. A non-terminal result is retried during a
five-minute reconciliation grace period.

After the grace period, Doraf releases the reservation but continues background
reconciliation.

### PF-058 — Late payment success

If payment succeeds after its reservation was released, Doraf attempts to
allocate fresh inventory. If the complete quantity is unavailable, the paid
order enters an operational exception queue for an Administrator to refund.

### PF-059 — Duplicate successful payment

If more than one payment attempt unexpectedly succeeds for the same order,
Doraf fulfills the order and credits the agent once. Additional successful
payments are recorded as excess payments and refunded.

### PF-060 — Payment mismatch

Doraf does not fulfill a payment whose provider reference, amount, or currency
does not match the expected payment attempt. It records the result for
Administrator investigation.

### PF-061 — Voucher refund boundary

A delivered voucher is normally non-refundable because its secret has been
exposed. Refunds are allowed for duplicate charges and paid orders that Doraf
cannot fulfill or recover.

When fulfillment cannot be completed with the original allocation, Doraf tries
audited replacement inventory before refunding.

### PF-062 — Mobile Money withdrawals

MVP withdrawals use Paystack Transfers and pay only the agent's registered Ghana
Mobile Money number. Bank-account withdrawals and third-party payout
destinations are outside the MVP.

The agent selects the Mobile Money network and completes a fresh Doraf SMS OTP
challenge for each request.

### PF-063 — Withdrawal amount and fee

The minimum net payout is GHS 10 and the provider maximum is GHS 50,000, subject
to a lower configurable Doraf risk limit.

The agent pays the GHS 1 Mobile Money transfer fee. A request is valid only when
the withdrawable amount covers the net payout plus fee.

Provider limits and fees are configuration based on current Paystack terms and
must be checked before launch and monitored for change.

### PF-064 — Withdrawal hold

Creating a withdrawal request atomically places a hold for the net payout plus
fee. Held funds cannot support another withdrawal.

### PF-065 — Administrator-approved payout

Every MVP withdrawal requires Administrator approval. An approved withdrawal
uses a unique Paystack transfer reference and Paystack's merchant transfer OTP
as a second operational control.

### PF-066 — Transfer outcome

While the Paystack transfer is non-terminal, the hold remains. Success converts
the hold into permanent payout and fee debits. Failure or reversal releases the
hold or compensates already-posted debits, depending on when it occurs.

### PF-067 — Reversal during withdrawal

If a sale reversal makes the wallet insufficient before Paystack initiation,
Doraf cancels the withdrawal and releases its hold.

If transfer processing has already begun, Doraf allows it to reach a terminal
state. A successful payout may leave the wallet balance negative.

### PF-068 — Negative balance behavior

A negative wallet balance blocks withdrawals but does not automatically block
new sales. Future sale credits offset the debt, and Doraf alerts Administrators.

### PF-069 — One SMS per voucher

Doraf sends one SMS per purchased voucher. For a multi-voucher order, messages
are numbered and each contains the order reference, checker product, voucher
position, serial number, 12-digit PIN, and WAEC usage reminder.

### PF-070 — One optional delivery email

When a web buyer provided a delivery email, Doraf sends one email containing all
vouchers in the order. Voucher secrets never appear in the email subject.

### PF-071 — Delivery retry policy

Delivery begins immediately after the paid-order transaction commits. An
explicitly rejected or failed provider request receives up to three retries,
approximately 1, 5, and 15 minutes after the initial attempt.

When a provider accepted a request but its outcome is unknown, Doraf reconciles
the existing request before resending.

### PF-072 — Independent delivery channels

SMS and optional email delivery are tracked separately. Success on one channel
does not cancel delivery through the other requested channel.

### PF-073 — Buyer voucher recovery

Self-service recovery is available immediately. The buyer supplies the
high-entropy order reference and verifies an SMS OTP sent to the order's
immutable delivery phone number.

Recovery exposes only that order's vouchers and no agent, payer, or unrelated
order information.

### PF-074 — Restricted manual resend

Support can inspect masked delivery history. Only an Administrator can trigger
an audited resend, and only to the order's original delivery destinations.

### PF-075 — Retained recoverable secrets

Doraf retains sold voucher serial-number/PIN pairs encrypted so buyers can
recover them. Raw values are excluded from logs, analytics, and ordinary
Support tools.

Delivery failure alone does not cause a refund because the recovery path remains
available.

### PF-076 — Dispute permissions

Support receives buyer complaints and inspects masked voucher data. Only an
Administrator can approve a replacement or refund.

### PF-077 — Doraf-error replacement

A wrong checker product, malformed PIN, mismatched serial-number/PIN pair, or
incomplete delivered quantity caused by Doraf qualifies for replacement.

### PF-078 — WAEC rejection evidence

An invalid or already-used voucher complaint requires the order reference,
exact WAEC error message, and preferably a screenshot. Doraf does not impose a
short claim deadline solely based on purchase date because unused vouchers have
no calendar expiration.

Student Index Number and examination details are collected only when genuinely
needed for Administrator or vendor investigation.

### PF-079 — Replacement limit and inventory treatment

A replaced voucher remains permanently excluded from available inventory and is
linked to its replacement. One standard-policy replacement is permitted per
voucher; further claims require explicit Administrator investigation.

Replacement does not create or reverse agent profit.

### PF-080 — Refund after unavailable replacement

When Doraf cannot provide a valid replacement, it refunds the affected
voucher's unit retail price and appends a proportional reversal debit for that
unit's agent profit.

A duplicate-payment refund has no agent-wallet effect because the excess
payment did not create an agent credit.

### PF-081 — Non-refundable buyer error or misuse

After voucher delivery, Doraf does not refund or replace:

- a checker product the buyer selected after its scope was displayed,
- delivery to a phone number or email the buyer entered and confirmed,
- use with an unsupported examination,
- an attempted fourth result check, or
- attempted use for another candidate or examination year.

### PF-082 — Audited dispute actions

Complaint intake, evidence access, decisions, replacement allocation, refunds,
and resulting inventory and wallet movements are audited.

### PF-083 — Permanent agent sales channels

Each agent receives one permanent personalized web sales link. The portal
provides copy and device-share actions.

Permanent web identifiers are never assigned to another agent.

### PF-084 — Agent pricing controls

The portal lets an agent set one retail price per checker product within the
agent's effective base-price and maximum-price range.

### PF-085 — Binary product availability

Agents see a checker product as `In stock` or `Unavailable`. They do not see
central inventory quantities, voucher values, batch information, or inventory
cost.

### PF-086 — Agent sales reporting

Agents see sales summaries for today, the last seven days, the last thirty days,
and lifetime. Order history includes reference, date, channel, product,
quantity, retail total, agent profit, and status.

### PF-087 — Buyer privacy from agents

Agent views mask buyer delivery phone numbers and do not expose payer numbers,
delivery emails, voucher secrets, or full buyer contact information.

### PF-088 — Agent wallet view

Agents see ledger balance, active holds, withdrawable amount, negative balance,
ledger history, withdrawal requests, and withdrawal status history.

### PF-089 — Agent notifications

Agents receive notifications for sales, pricing-policy adjustments, payment
reversals, negative balances, and withdrawal outcomes.

The channel and urgency policy for each notification type remain open.

### PF-090 — Privacy-safe agent export

Agents can export sales and ledger history as CSV. Exports exclude buyer
personal information, voucher secrets, internal inventory data, and platform
cost details.

### PF-091 — Suspended portal

A suspended agent retains read-only access to historical sales, reports,
wallet, and withdrawal history. New sales, price changes, and new withdrawal
requests are disabled. An Administrator decides how to handle existing funds
and pending withdrawals.

### PF-092 — Agent portal MVP exclusions

The MVP excludes custom branding, custom domains, multiple campaign links or
codes, customer lists, agent staff, and delegated access.

### PF-093 — Administration dashboard

The administration portal summarizes sales, payments, fulfilled vouchers,
agent-profit liabilities, withdrawals, refunds, delivery failures, disputes,
negative wallets, and inventory health.

### PF-094 — Exact internal inventory

Administrators see exact available, reserved, sold, quarantined, replaced, and
refunded inventory counts by checker product. Configurable low-stock thresholds
produce operational alerts.

### PF-095 — Controlled inventory import

Inventory CSV import provides a validation preview and row-level errors before
an Administrator explicitly commits the complete batch.

### PF-096 — Administration work queues

The portal provides operational queues for:

- payment and fulfillment exceptions,
- delivery failures,
- withdrawals,
- disputes and evidence,
- replacements,
- refunds, and
- reconciliation discrepancies.

### PF-097 — Masked-by-default voucher access

Voucher values are masked by default. An Administrator reveal requires a fresh
step-up confirmation, an entered reason, and a sensitive-action audit record.

### PF-098 — Support administration boundary

Support receives read-only investigation screens and complaint-intake tools.
Support cannot reveal voucher secrets, change money or inventory, approve
withdrawals, replace vouchers, refund payments, suspend agents, or recover
accounts.

### PF-099 — Searchable immutable audit history

Authorized Administrators can search immutable audit history by operator,
action, reason, affected record, and timestamp.

### PF-100 — Restricted administration tooling

The product does not expose a raw SQL console, arbitrary wallet or ledger entry
form, bulk raw-voucher export, agent impersonation, or unaudited record mutation.

### PF-101 — Reporting time

Doraf stores timestamps in UTC and applies the `Africa/Accra` timezone for
product reporting.

Agent report periods are:

- today: the current Accra calendar day,
- 7 days: today and the previous six Accra calendar days,
- 30 days: today and the previous twenty-nine Accra calendar days, and
- lifetime: all recorded activity.

### PF-102 — Sales metrics

Gross sales value is the retail total of successful orders before refunds. Net
sales value is gross sales value minus completed refunds.

Excess or duplicate payments do not count as sales.

### PF-103 — Agent financial metrics

Agent earnings equal sale-profit credits minus payment-reversal and
refund-reversal debits.

Positive wallet balances are reported as agent liabilities. Negative balances
are reported separately as agent debt and are not netted against the positive
liability figure.

### PF-104 — Doraf revenue and contribution

Gross base-price revenue is the sum of base-price snapshots for sold voucher
units. Reporting separately identifies refunded and payment-reversed sales.

Realized contribution subtracts allocated voucher acquisition cost,
payment-provider fees, delivery costs, and other directly attributable provider
costs from the applicable base-price revenue.

### PF-105 — Continuous and daily reconciliation

Doraf performs continuous exception checks and a formal daily reconciliation
covering payments, orders, inventory, agent ledger entries, refunds, reversals,
withdrawals, transfers, settlements, and delivery-provider costs.

### PF-106 — Immutable reconciliation cases

Reconciliation does not repair discrepancies by editing source records. It
creates an assigned case with evidence and resolves the cause using an audited
domain action or compensating entry.

Each reconciliation run retains immutable inputs, totals, discrepancies,
operator actions, and completion status.

### PF-107 — Shared metric sources

Agent dashboards, administration dashboards, and exports use the same canonical
orders, inventory movements, provider records, and wallet ledger entries.

### PF-108 — Restricted agent earnings balance

The agent wallet is a ledger of earnings and related adjustments, not a
general-purpose stored-value account.

The MVP does not permit:

- cash or Mobile Money top-ups,
- buyer deposits,
- transfers between agents,
- peer-to-peer transfers,
- interest,
- spending the balance on other products, or
- withdrawal to an unregistered destination.

### PF-109 — Data protection governance

Before production processing, Doraf registers with Ghana's Data Protection
Commission, assigns responsibility for data protection, maintains a
data-processing inventory, and publishes clear privacy notices for agents and
guest buyers.

### PF-110 — Data purpose and minimization

Every personal-data field has a documented purpose and lawful basis. Ordinary
sales and recovery do not collect a student's Index Number, examination
details, or age.

### PF-111 — Provider data controls

Doraf maintains written processing and security terms with payment, SMS, email,
hosting, monitoring, and support providers. Data locations and
cross-border processing are documented and reviewed.

### PF-112 — Data rights and retention

Doraf implements data-subject request procedures and a category-specific
retention schedule for accounts, orders, payments, voucher secrets, OTPs, logs,
audit records, exports, and dispute evidence.

Deletion requests do not silently remove records that must remain for legal,
security, accounting, fraud, or dispute purposes.

### PF-113 — Incident and breach response

Doraf maintains an incident-response process covering detection, containment,
evidence, restoration, communication, and notification to the Data Protection
Commission and affected people where required.

### PF-114 — Strong internal authentication

Administrator and Support accounts use stronger authentication than agent SMS
OTP. Phishing-resistant passkeys are preferred, with an approved
authenticator-based MFA and recovery design.

### PF-115 — Secret and provider security

Doraf encrypts voucher secrets and sensitive personal data, separates encryption
keys from application data, audits decryption, rotates keys, verifies provider
webhooks, protects API credentials, and isolates test and production
environments.

Non-production systems cannot initiate production money movement.

### PF-116 — External launch approvals

Production launch is blocked until Doraf completes:

- Ghana data-protection registration and readiness,
- qualified review of Bank of Ghana implications,
- Paystack production onboarding and contracts,
- written WAEC-vendor authorization for resale and electronic delivery,
- applicable tax and accounting advice,
- processor and provider agreements, and
- review of minor-related and consumer-facing obligations.

### PF-117 — Confirmed MVP boundary

The MVP includes the complete controlled lifecycle from individual agent
registration through attributed web sales, payment, encrypted
inventory allocation, delivery, recovery, ledger credit, withdrawal, disputes,
reconciliation, and internal operations.

The detailed boundary is maintained in `docs/product/06-mvp-scope.md`.

## Proposed product principles

These are recommendations and are not yet confirmed:

- A buyer should receive a valid PIN at most once per successfully paid order.
- A PIN should be delivered for at most one order.
- Every movement of inventory and money should be auditable.
- Payment callbacks, fulfillment jobs, and notifications should be safely
  repeatable without duplicating their effects.
- Operational staff should be able to investigate and recover failed orders
  without editing balances or inventory directly.
- Agent-facing balances should be backed by an immutable transaction ledger.

## Initial success criteria

These are proposed and require measurable targets:

- A buyer can purchase and receive a PIN without manual intervention.
- The correct agent receives the correct profit for each completed sale.
- The platform never sells the same PIN twice.
- The platform can reconcile collected payments, fulfilled orders, agent
  earnings, and withdrawals.
- Support staff can determine what happened to any payment or PIN using an
  audit trail.

## Product boundaries still to define

- Whether wallet funds may be spent inside the platform
- Whether refunds or PIN replacements are supported
- Whether post-MVP campaign links or USSD identifiers are introduced
- The acceptable evidence an Administrator must collect before account recovery
- The production domain used for synthetic Paystack customer emails

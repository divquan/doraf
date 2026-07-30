# Agent portal

Status: Confirmed MVP scope  
Last updated: 2026-07-30

## Purpose

The agent portal lets an individual configure checker prices, distribute
permanent sales channels, monitor attributed sales, understand wallet activity,
and request withdrawals without exposing central inventory or buyer secrets.

## Authentication

Agents sign in with their registered phone number and an SMS OTP. The portal has
no reusable password or sign-in PIN.

One phone number belongs to one individual agent account. Account recovery uses
the confirmed Administrator workflow.

## Home dashboard

The dashboard shows:

- sales value and agent profit for today,
- sales value and agent profit for the last seven days,
- sales value and agent profit for the last thirty days,
- lifetime sales value and agent profit,
- ledger balance,
- held amount,
- withdrawable amount,
- negative balance when applicable,
- checker-product availability, and
- recent orders and wallet activity.

Reports use `Africa/Accra` calendar boundaries. Today means the current calendar
day; 7 days includes today and the previous six days; 30 days includes today and
the previous twenty-nine days.

## Sales channels

Each agent receives:

- one permanent personalized web sales link, and
- one permanent USSD referral code.

The portal provides copy and device-share actions. It clearly identifies which
checker prices buyers will see.

Agents cannot customize the URL, code, domain, or branding in the MVP. Retired
USSD referral codes are never assigned to another agent.

## Pricing

For each checker product, the agent sees:

- effective base price,
- effective maximum retail price,
- current retail price, and
- profit per voucher at the selected retail price.

The agent may change the active retail price within the effective range. The
portal explains automatic adjustments caused by an Administrator changing the
effective pricing policy.

## Product availability

Agents see only:

- `In stock`, or
- `Unavailable`.

They do not see:

- item or batch counts,
- serial numbers or PINs,
- acquisition cost,
- vendor information,
- reserved inventory, or
- another agent's sales or configuration.

## Orders and sales

Order history includes:

- order reference,
- creation date and time,
- channel: web or USSD,
- checker product,
- quantity,
- retail total,
- total agent profit, and
- safe commercial status.

The agent may filter and paginate history. Buyer delivery phone numbers are
masked. The portal does not expose:

- full delivery phone number,
- Mobile Money payer number,
- optional delivery email,
- synthetic Paystack email,
- serial number or PIN,
- payment-provider secrets, or
- internal investigation details.

Order status wording should represent the agent-relevant commercial outcome
without exposing ambiguous internal states.

## Wallet and withdrawals

The portal shows:

- ledger balance,
- held amount,
- withdrawable amount,
- sale credits,
- payment and refund reversal debits,
- withdrawal payout and fee debits,
- compensating entries,
- withdrawal request status, and
- masked withdrawal destination.

The agent can request a withdrawal only under the confirmed eligibility, OTP,
fee, destination, and amount rules.

## Notifications

The agent is notified of:

- successful attributed sales,
- Administrator pricing-policy changes that affect the agent,
- automatic retail-price adjustment,
- payment reversal and related wallet debit,
- negative balance,
- withdrawal request receipt,
- withdrawal approval or rejection, and
- terminal transfer outcome.

Which events use in-portal notification, SMS, or both remains open. Notification
failure does not alter the underlying sale, pricing, wallet, or withdrawal.

## Exports

Agents can export:

- sales history, and
- wallet ledger history.

CSV exports exclude buyer personal data, voucher secrets, Paystack customer
identifiers, vendor data, inventory counts, acquisition cost, and Doraf margin.
Export access and generation are audited.

## Suspended agent

A suspended agent can sign in and view historical:

- dashboard metrics,
- orders,
- wallet entries,
- withdrawal requests, and
- exports, subject to the same privacy restrictions.

The experience is read-only. It disables:

- new sales through the agent's channels,
- price changes, and
- new withdrawal requests.

An Administrator decides how to handle existing funds and any pending
withdrawal.

## Explicitly outside the MVP

- Custom storefront branding
- Custom domains
- Custom or multiple sales links
- Multiple USSD or campaign codes
- Customer lists or contact-management tools
- Agent staff accounts
- Invitations, team roles, or delegated access
- Buyer messaging or marketing tools
- Agent access to voucher values

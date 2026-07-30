# Users and roles

Status: Discovery  
Last updated: 2026-07-30

## Agent

An agent is an individual who markets PINs through personalized sales channels
and earns a profit on attributed sales.

### MVP account model

- An agent registers with a name and phone number.
- An agent is not required to provide an email address, identity document, or
  business information.
- Identity verification is not part of the MVP.
- An agent signs in with their phone number and an SMS one-time password.
- Agents do not create reusable passwords or sign-in PINs.
- A phone number can be associated with only one agent account.
- One agent tenant contains exactly one user.
- An agent cannot invite staff or delegate access in the MVP.

An Administrator handles account recovery manually during the MVP when an
agent loses access to their registered phone number. The Administrator must
record a reason and successfully verify an OTP sent to the replacement phone
number. The acceptable evidence of the agent's ownership of the original
account remains to be defined.

An agent must complete a fresh SMS OTP challenge when requesting a withdrawal,
even if they recently signed in.

### Tenant boundary

Each agent's account is a separate tenant. Agent-owned configuration and
commercial data must be scoped to that tenant, including:

- retail pricing,
- sales-channel identifiers,
- attributed orders,
- earnings and withdrawals, and
- agent-facing reports.

Central PIN inventory is platform-owned and is not partitioned by agent.

An order must permanently record the agent attribution that existed when the
order was created. Later changes to links, codes, prices, or agent status must
not silently transfer an existing order to another agent.

### Suspended agents

A suspended agent:

- may sign in,
- may view historical sales in read-only form,
- cannot receive new sales, and
- may withdraw an existing balance only when an administrator permits it.

Their portal is read-only: historical sales, wallet activity, withdrawal
history, and privacy-safe exports remain visible, while price changes and new
withdrawal requests are disabled.

Suspension must not prevent a buyer from receiving or recovering a PIN for an
order that was successfully paid before the suspension.

## Buyer

A buyer can complete a purchase as a guest and does not need a platform
account.

The system must distinguish:

- the buyer-entered PIN delivery phone number, and
- the Mobile Money payer phone number, and
- an optional buyer-provided delivery email.

These numbers may be different. The method used to confirm the delivery number
is double entry: the buyer enters it twice before payment. The MVP does not
verify the delivery number using an OTP before payment.

A buyer can recover a previously purchased PIN by supplying the order reference
and successfully verifying the delivery phone number. Recovery must not expose
other orders or agent information.

The buyer, Mobile Money payer, PIN recipient, and student may be different
people. Product copy and data naming should not assume they are the same person.

Doraf does not require a guest buyer to provide an email. A synthetic email
generated to satisfy Paystack's API is integration metadata and must not be
presented or used as the buyer's contact information. However, a buyer may
optionally provide a real email specifically to receive the purchased vouchers.
The delivery email and Paystack synthetic email are separate fields with
separate purposes.

## Student

The student is the intended user of the WAEC result-checking PIN. The MVP does
not currently require the platform to identify the student or create a student
account.

## Platform operators

The MVP has two internal roles:

- **Administrator** — manages inventory, withdrawals, refunds, agent
  suspensions, account recovery, and system configuration.
- **Support** — inspects agents, orders, payments, delivery attempts, and masked
  PIN information.

Support cannot move money, upload inventory, reveal unused PIN values, suspend
agents, change account ownership, or modify system configuration.

Internal operators cannot impersonate an agent. They must use dedicated
internal tools. Every sensitive action must capture the operator, timestamp,
reason, action, and affected record.

Inventory uploads do not require approval by a second operator in the MVP.

## Explicitly outside the MVP

- Business or organization agent accounts
- Agent staff accounts
- Agent team roles and invitations
- Buyer accounts
- Agent identity verification performed by Doraf
- Reusable agent passwords or sign-in PINs
- Automated agent account recovery
- Delivery-number verification by OTP

External service providers may impose requirements that override an assumed
flow. Those obligations must be verified before launch.

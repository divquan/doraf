# Administration and operations

Status: Discovery  
Last updated: 2026-07-30

## Roles

### Administrator

An Administrator can:

- upload and manage centrally owned PIN inventory,
- review and act on withdrawal requests,
- issue refunds or replacements when the relevant policy permits them,
- suspend and restore agent accounts,
- perform documented agent account recovery,
- manage default and agent-specific pricing policies,
- manage system configuration, and
- access sensitive operational information required to perform those duties.

An inventory upload does not require second-person approval in the MVP.

Every withdrawal requires Administrator review and a recorded approval or
rejection reason. Approved MVP transfers also retain Paystack's merchant OTP as
a second operational control.

## Portal principles

- Use purpose-built actions rather than generic record editing.
- Mask voucher secrets by default for both internal roles.
- Require step-up confirmation and a reason for Administrator reveal.
- Connect orders to their payment, inventory, delivery, wallet, refund, and
  dispute history.
- Present discrepancies for investigation without silently correcting them.
- Audit sensitive reads as well as sensitive writes.

The portal never provides raw SQL, direct wallet balance editing, arbitrary
ledger entries, bulk voucher-secret export, or agent impersonation.

## Operational queues

The administration portal provides queues for:

- payment and fulfillment exceptions,
- delivery failures,
- withdrawals,
- disputes,
- replacements and refunds, and
- reconciliation discrepancies.

Queues expose status, age, ownership, and safe diagnostic context. The detailed
assignment and service-level policy remain open.

### Support

Support can inspect:

- agent profiles and status,
- orders and their state history,
- payment attempts and provider references,
- SMS and other delivery attempts, and
- masked PIN information associated with an order.

Support can record complaints and evidence but cannot approve or execute
replacements, refunds, or goodwill actions.

Support cannot:

- upload or alter PIN inventory,
- reveal unused PIN values,
- approve or create money movement,
- issue refunds or replacements,
- trigger voucher delivery or resend,
- approve withdrawals,
- suspend or restore agents,
- recover an account or change its owner,
- change system configuration,
- change product, agent, or order pricing,
- impersonate an agent.

## No impersonation

Internal operators use dedicated administration and support interfaces. The
platform does not create a session that acts as the agent.

When troubleshooting requires comparison with an agent's view, internal tools
may present the same underlying state but must retain the internal operator's
identity and permissions.

## Sensitive-action audit

Every sensitive administrative operation must append an audit record
containing:

- the internal operator,
- their role at the time,
- the action,
- the affected entity and identifier,
- the timestamp,
- the operator-entered reason, and
- relevant before-and-after metadata with secrets masked.

Audit history must not be editable through normal administration tools.

Sensitive actions include at least:

- inventory upload or correction,
- withdrawal approval, rejection, or cancellation,
- withdrawal provider initiation and terminal outcome,
- refund or replacement,
- agent suspension or restoration,
- account recovery or phone-number change,
- default or agent-specific pricing-policy changes,
- manual voucher resend,
- dispute replacement, refund, rejection, or goodwill decision,
- access to a raw PIN value, and
- privacy-sensitive administrative export,
- system configuration changes.

Retention requirements and whether audit records need tamper-evident storage
remain open.

## Agent account recovery

An Administrator handles recovery manually:

1. Find the existing agent account.
2. Collect evidence under the recovery policy.
3. Record the recovery reason.
4. Enter the replacement phone number.
5. Verify an OTP sent to the replacement number.
6. Apply the change and append a sensitive-action audit record.

The acceptable ownership evidence and any waiting period before withdrawal
remain open. Verifying the replacement number proves control of that number; it
does not by itself prove ownership of the existing agent account.

## Buyer PIN recovery

A buyer may retrieve the PIN for a completed order by:

1. providing the order reference,
2. completing verification of the order's delivery phone number, and
3. receiving or viewing only the PIN belonging to that order.

The verification mechanism is expected to be an SMS OTP, but this detail is
still to be confirmed as part of the fulfillment flow. Recovery attempts must
be rate-limited and audited.

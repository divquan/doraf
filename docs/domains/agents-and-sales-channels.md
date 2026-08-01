# Agents and sales channels

Status: Confirmed MVP scope
Last updated: 2026-08-01

## Responsibilities

This domain owns:

- personalized agent web links,
- resolution of a sales channel to an agent tenant,
- channel activation and deactivation, and
- the attribution captured on an order.

It does not own orders, product prices, payments, or wallet credits.

## Web channel

Each agent has one permanent personalized web sales link in the form
`/buy/{public-id}`. The public ID is a database-generated, non-sequential,
lowercase 24-character hexadecimal value. It contains no name, phone number, or
internal account identifier. Agents cannot rename or customize it in the MVP.

Resolving the link must identify an active agent before checkout creates an
order. Unknown identifiers and identifiers belonging to suspended agents return
the same not-found response.

## USSD channel

USSD purchase and referral codes are deferred until after the MVP. The MVP has
one sales channel: the permanent personalized web link.

## Attribution

Before showing the final purchase confirmation, Doraf must:

- resolve the channel identifier,
- verify that the agent exists and can receive new sales, and
- show enough agent identity for the buyer to detect a mistyped code.

Order creation snapshots the resolved agent and source channel. Later changes
to pricing or agent status do not change an existing order's attribution.

Unknown, disabled, or suspended-agent channel identifiers cannot create new
orders.

## Code lifecycle

Permanent web identifiers are not changed or reassigned because old printed or
forwarded material could otherwise attribute sales to another agent. Custom
links and multiple campaign links are outside the MVP.

# Agents and sales channels

Status: Discovery  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- personalized agent web links,
- agent USSD referral codes,
- resolution of a sales channel to an agent tenant,
- channel activation and deactivation, and
- the attribution captured on an order.

It does not own orders, product prices, payments, or wallet credits.

## Web channel

Each active agent has a personalized web sales link. Resolving the link must
identify the agent before checkout creates an order.

The final URL format, custom slugs, and whether agents can rename their link
remain open.

## USSD channel

Doraf uses one shared USSD service code. Each agent receives a short unique
referral code.

The preferred entry point, when supported by the provider, embeds the referral
code in the dial string:

```text
*<service-code>*<agent-code>#
```

The fallback entry point asks the buyer to enter the agent code after dialing
the shared service code.

The exact code alphabet and length depend on USSD-provider constraints. Codes
should be easy to read and enter on a numeric handset keypad.

Each agent has one permanent web identifier and one permanent USSD referral
code in the MVP. Agents cannot customize or create campaign variants.

## Attribution

Before showing the final purchase confirmation, Doraf must:

- resolve the channel identifier,
- verify that the agent exists and can receive new sales, and
- show enough agent identity for the buyer to detect a mistyped code.

Order creation snapshots the resolved agent and source channel. Later changes
to an agent's link, referral code, pricing, or status do not change an existing
order's attribution.

Unknown, disabled, or suspended-agent channel identifiers cannot create new
orders.

## Code lifecycle

Retired agent codes are never reassigned because old printed or forwarded
material could otherwise attribute sales to another agent.

The exact code alphabet and length remain open. Custom codes and multiple
campaign codes are outside the MVP.

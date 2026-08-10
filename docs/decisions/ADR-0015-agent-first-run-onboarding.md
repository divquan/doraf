# ADR-0015: Use a resumable, server-tracked agent first-run onboarding

Status: Accepted  
Date: 2026-08-10

## Context

The confirmed agent onboarding flow already includes initial product setup,
pricing, availability, and sales-link sharing. The agent portal needs a simple
post-login experience that helps a new agent try those actions and gives the
team reliable completion evidence. Browser-only state cannot resume across
devices or distinguish a completed setup from a dismissed prompt.

## Decision

Show a short, non-blocking onboarding modal after an active agent signs in. It
contains four checklist steps in this order:

1. Give the store a name and configure its public link.
2. Set a valid retail price for each configured product.
3. Review binary product availability.
4. Copy or open the finished storefront link.

The modal has a clear progress count, can be postponed, and exposes a small
resume action after dismissal. The server stores one `AgentOnboarding` record
per agent with start, step, dismissal, and completion timestamps. The final
completion action is accepted only when the server can verify the store
identity, configured prices, and the recorded review/share actions. No buyer,
voucher, phone, or other sensitive data is collected by onboarding tracking.

## Consequences

- New active agents get guided setup without being blocked from the portal.
- A dismissed checklist returns on a later login until it is completed.
- Product and growth reporting can distinguish started, progressed, dismissed,
  and completed onboarding from durable timestamps.
- The agent API and schema carry a small additional lifecycle record that must
  be migrated and retained with the agent account.
- Product availability remains informational; onboarding does not expose stock
  counts or inventory secrets.

## Alternatives considered

- **Local storage only:** easy to add, but not durable across browsers and not
  reliable for completion reporting.
- **Hard-gated setup:** stronger completion pressure, but prevents agents from
  exploring the portal and conflicts with the read-only/resumable portal model.
- **External analytics events only:** useful for funnels, but cannot enforce a
  server-verified completion state.

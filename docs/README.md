# Dashchecker product and architecture documentation

This directory is the durable source of product context for humans and coding
agents working on Dashchecker. Chat transcripts, tickets, and implementation details
may supplement these documents, but they do not replace confirmed decisions
recorded here.

## Current state

The product is in active implementation with some external discovery and launch
readiness work still open. Check the
[MVP implementation progress](planning/implementation-progress.md) before
starting work. Requirements marked **Confirmed** came directly from the product
owner. Items marked **Proposed** are recommendations awaiting approval. Items
marked **Assumption** must be validated before they become requirements.

## Start here

1. Check [MVP implementation progress](planning/implementation-progress.md).
2. Read [Platform brief](product/00-platform-brief.md).
3. Review [Open questions](planning/open-questions.md) before making a decision
   in an unsettled area.
4. Review [Risks and assumptions](planning/risks-and-assumptions.md).
5. Use the [Glossary](planning/glossary.md) consistently in code and prose.
6. Check [Decision records](decisions/README.md) for accepted cross-cutting
   decisions.

## Implementation entry points

- [Local development with Docker Compose](development.md)
- [System context](architecture/system-context.md)
- [Logical data model](architecture/data-model.md)
- [Domain state machines](architecture/state-machines.md)
- [Transaction integrity](architecture/transaction-integrity.md)
- [Infrastructure, observability, and recovery](architecture/infrastructure-and-recovery.md)
- [Deployment TODO](planning/deployment-todo.md)
- [Lean Supabase and Google Cloud infrastructure](architecture/lean-infrastructure-and-costs.md)
- [Physical database schema plan](architecture/database-schema-plan.md)
- [Database constraints and indexes](architecture/database-constraints-and-indexes.md)
- [Database invariant and concurrency tests](architecture/database-test-plan.md)
- [Initial schema migration plan](planning/schema-migration-plan.md)
- [MVP delivery phases](planning/delivery-phases.md)
- [MVP implementation progress](planning/implementation-progress.md)

## Planned documentation map

- `product/` — users, journeys, business rules, scope, and roadmap
- `domains/` — behavior and ownership of individual business capabilities
- `flows/` — end-to-end happy paths and failure paths
- `architecture/` — system boundaries, data, security, and operations
- `decisions/` — durable architecture and product decision records
- `planning/` — open questions, assumptions, risks, phases, and terminology

Documents should be created when they contain useful decisions or analysis.
Avoid creating empty placeholders.

## Documentation rules

- Separate confirmed facts from proposals and assumptions.
- Give important rules stable identifiers when they are referenced across
  domains.
- Document failure and recovery behavior, not only happy paths.
- Record material changes in a decision record rather than silently rewriting
  the reasoning.
- Keep implementation-specific details out of product requirements unless the
  implementation itself is a confirmed constraint.

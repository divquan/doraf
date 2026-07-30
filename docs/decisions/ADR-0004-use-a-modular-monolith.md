# ADR-0004: Use a modular monolith

Status: Accepted  
Date: 2026-07-30

## Context

Doraf has strongly related inventory, payment, wallet, delivery, and refund
transactions. The MVP team needs clear domain ownership without introducing
distributed transaction and deployment complexity before measured need exists.

## Decision

Implement business capabilities as explicit NestJS modules in one API codebase.
Deploy request handling and asynchronous workers as separate processes using the
same domain modules and PostgreSQL database.

Do not create microservices for the MVP.

## Consequences

- Critical cross-domain invariants can use PostgreSQL transactions.
- Deployment and local development remain comparatively simple.
- Module boundaries must be enforced by code organization, interfaces, tests,
  and ownership rather than network calls.
- API and worker processes can scale independently.
- A module may later be extracted when evidence justifies it.

## Alternatives considered

### Microservices from launch

Rejected because distributed state, messaging, deployment, and reconciliation
costs outweigh demonstrated MVP benefits.

### Unstructured monolith

Rejected because shared deployment does not justify unclear ownership or direct
cross-domain mutation.

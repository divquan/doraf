# ADR-0006: Use a transactional outbox

Status: Accepted  
Date: 2026-07-30

## Context

After a payment commits, Dashchecker must not lose SMS, email, notification, and
follow-up work. Calling external providers before commit can expose vouchers for
an order that is not durably paid. Calling them after commit without durable
intent can lose work if the process crashes.

## Decision

Write asynchronous work intent to a PostgreSQL outbox in the same transaction
as the owning domain change.

Run workers separately from API request processes. Dispatch outbox work through
a durable at-least-once queue and make every handler idempotent.

## Consequences

- A committed commercial transition retains durable follow-up intent.
- External calls occur after commit.
- Workers can retry safely and scale separately.
- Outbox dispatch, queue delivery, and provider calls may repeat, so stable
  references and reconciliation remain mandatory.
- Operational monitoring must detect stuck outbox and job records.

## Alternatives considered

### Call providers inside database transactions

Rejected because network calls create long transactions and cannot participate
atomically in the PostgreSQL commit.

### Publish to a queue after commit without an outbox

Rejected because a process crash between database commit and queue publication
can permanently lose required work.

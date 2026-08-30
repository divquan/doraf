# ADR-0008: Use pg-boss for MVP background jobs

Status: Superseded by ADR-0010 for the selected hosted deployment
Date: 2026-07-30

## Context

Dashchecker needs delayed verification, delivery retries, reservation expiry,
notifications, exports, and reconciliation. PostgreSQL is already the canonical
store, and the MVP should minimize additional stateful infrastructure without
weakening durable job execution.

The transactional outbox remains the durable business intent. A queue provides
worker scheduling, retry, concurrency, and dead-letter behavior.

## Decision

Use `pg-boss` with PostgreSQL for the MVP durable job queue.

Run it in a dedicated PostgreSQL schema. Dispatch minimal jobs from Dashchecker
outbox records and process them in the separate worker deployment.

Assume handlers and provider side effects can be observed more than once despite
queue delivery guarantees. Keep all handlers idempotent and reconcile ambiguous
external outcomes.

Adopt a current supported `pg-boss` release during implementation. Its current
documented runtime requirement is Node.js 22.12 or newer, so raise Dashchecker's Node
engine floor accordingly rather than pinning an obsolete queue release.

## Consequences

- No Redis or separate broker is required for the MVP.
- Queue data participates in PostgreSQL backup and operations.
- Delays, retries, priorities, queue policies, and dead-letter queues are
  available.
- Queue load consumes PostgreSQL connections and resources and must be monitored.
- Job payloads remain minimal and contain no voucher secrets.
- At larger scale, database and queue load may justify a separately operated
  broker without changing domain idempotency.

## Alternatives considered

### BullMQ and Redis

Deferred because it adds another stateful system before measured queue volume
requires it.

### Poll only the custom outbox

Rejected as the sole job mechanism because Dashchecker would need to build retry,
scheduling, concurrency, heartbeat, and dead-letter capabilities already
provided by a maintained queue.

### Publish directly without a Dashchecker outbox

Rejected because the outbox is the durable, inspectable business intent and
supports recovery if queue dispatch is interrupted.

## References

- https://github.com/timgit/pg-boss
- https://timgit.github.io/pg-boss/api/queues
- https://timgit.github.io/pg-boss/api/workers

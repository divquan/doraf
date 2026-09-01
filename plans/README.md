# Cloud Tasks replacement plan

This is a clean replacement of the current Redis outbox worker with Cloud
Tasks and request-driven Cloud Run services. It is not a migration plan: the
repository is in early development, so the executor should remove Redis code
and configuration once the Cloud Tasks path is verified.

## Decision boundary

- PostgreSQL remains the canonical database and transactional outbox.
- Cloud Tasks is the immediate at-least-once delivery mechanism for outbox
  work.
- Cloud Run hosts the public API and a separate private HTTP task consumer.
- Cloud Run Jobs plus Cloud Scheduler run bounded reconciliation, lease
  recovery, and outbox-publication repair.
- Agent registration/login OTP delivery remains direct synchronous SMS. It is
  explicitly out of scope for Cloud Tasks.
- Redis, Redis Streams, the continuous `worker-main`, and their configuration
  are removed. No compatibility provider or dual-write period is required.

## Current verified baseline

At planned commit `3bfad014`:

- `apps/api/src/main.ts` starts the HTTP API on `0.0.0.0` and the configured
  `PORT`.
- `apps/api/src/job-main.ts` is a run-once process with an allowlist of job
  names, but it currently imports Redis dispatch/consume code for `outbox`.
- `apps/api/src/worker-main.ts` starts a continuous Nest application context.
- `apps/api/src/operations/redis-outbox.queue.ts` uses the Redis Stream
  `dashchecker:outbox` and consumer group `dashchecker:outbox-workers`.
- `apps/api/src/operations/outbox.service.ts` already provides PostgreSQL
  claim, lease, `QUEUED`, `DISPATCHED`, reschedule, and stale-claim recovery
  operations.
- The handler classes already implement domain-specific idempotent processing:
  `PricingOutboxHandler`, `RefundOutboxHandler`,
  `WithdrawalOutboxHandler`, and `DeliveryOutboxHandler`.
- `pnpm --filter @dashchecker/api typecheck` and
  `pnpm --filter @dashchecker/api build` both pass at the baseline.

## Execution order

| Plan | Part                                                          | Depends on | Status |
| ---- | ------------------------------------------------------------- | ---------- | ------ |
| 001  | Add the Cloud Tasks publisher and outbox task contract        | none       | DONE   |
| 002  | Add the private HTTP Cloud Tasks consumer                     | 001        | TODO   |
| 003  | Remove Redis and continuous polling workers                   | 001, 002   | TODO   |
| 004  | Package and deploy Cloud Run, Cloud Tasks, and scheduled Jobs | 003        | TODO   |

Dependency graph: `001 -> 002 -> 003 -> 004`.

Each executor must run the verification gates in its plan before moving to the
next part. Do not mark a part complete because the code compiles alone; the
specific behavioral gate in that part must pass.

## Global verification commands

Run from the repository root unless a plan says otherwise:

```sh
pnpm --filter @dashchecker/api typecheck
pnpm --filter @dashchecker/api build
pnpm --filter @dashchecker/api test -- --runInBand
pnpm typecheck
pnpm lint
```

The existing repository has unrelated working-tree changes. Executors must
preserve them and report any out-of-scope modifications instead of reverting
them.

## Status update convention

An executor may update only the relevant status row after its verification
gates pass. Use `DONE`, `BLOCKED`, or leave `TODO`; include the failing command
and reason for `BLOCKED`. Do not commit or push unless the operator explicitly
asks for that separately.

# MVP implementation progress

Status: Active tracker  
Last updated: 2026-09-01

This document records implementation state only. It does not redefine the MVP
or duplicate its delivery plan. Requirements remain in
[MVP scope](../product/06-mvp-scope.md), and dependency order remains in
[Delivery phases](delivery-phases.md).

## Status meanings

- **Complete** — implemented and verified for the stated slice.
- **Partial** — useful implementation exists, but the phase exit criteria are
  not satisfied.
- **Next** — the next implementation slice.
- **Not started** — no meaningful domain implementation exists yet.
- **External** — provider, legal, operational, or production evidence is needed
  outside the codebase.

Scaffolding alone does not count as implementation. A delivery phase is only
complete when its exit criteria in `delivery-phases.md` pass.

## Current position

The API foundation, product catalog, encrypted inventory import backend, internal
passkey authentication backend, and first agent OTP authentication slice are
implemented. The administration application has a working passkey flow, and the
agent application now has production-shaped registration, sign-in, and protected
workspace screens.

**Manual acceptance evidence:** on 2026-08-01, a product-owner completed one
Paystack Inline popup sandbox payment successfully. All six manual buyer-recovery acceptance checks passed on 2026-08-01. Phase 5 agent withdrawal manual acceptance passed on 2026-08-01.

**Phase 7 completion evidence:** on 2026-08-02, the Admin Operations & Finance
Dashboard, Continuous Invariant Checks & Reconciliation Worker, and Stuck Outbox
Inspector with Re-queue Controls were implemented, verified (56 unit tests, clean
typecheck and lint), and accepted. Privacy-Safe Data Exports deferred by
product-owner decision.

**Phase 8 audit evidence:** on 2026-08-02, a full production readiness audit
passed across security (AES-256-GCM, HMAC-SHA256, WebAuthn RP validation,
timing-safe OTP comparison), provider integration (Paystack webhook signature,
mode guards), background workers (8/8 test-safe), database (25 migrations), and
monorepo build health (typecheck, lint, test, build all pass).

**Next slice:** Two external go-live items remain: (1) production SMS/email
delivery gateway adapter, and (2) CORS origin whitelist if API and frontends are
on different domains. Privacy-Safe Data Exports are deferred to post-launch
enhancement.

**Runtime update:** The immediate outbox path now uses Cloud Tasks, including
production delivery events. Redis adapters and continuous polling workers were
removed; reconciliation and outbox repair run through bounded jobs. The API,
API unit suite, honest lint, build, and monorepo typecheck pass. PostgreSQL
integration evidence remains blocked until `TEST_DATABASE_URL` is supplied.

**Packaging update (Plan 004):** The private task-consumer entrypoint
(`apps/api/src/task-main.ts` → `dist/task-main.js`, `TaskConsumerModule`,
`OutboxTaskController` at `POST /internal/tasks/outbox`) is reconciled and
exposes `start:task-consumer`. One immutable image (`Dockerfile` pinned
Node 20, non-root, frozen lockfile, `prisma generate` + `build`, no `.env` or
build-arg secrets; `cloudbuild.yaml` records digest) contains
`dist/main.js`, `dist/task-main.js`, and `dist/job-main.js`. Deployment
packaging for Cloud Tasks queue (`dashchecker-outbox` bounded
retry/backoff/rate, OIDC audience pinned), private task-consumer service
(`ingress=internal`, `run.invoker` only for the task-invoker SA), public API
(`WORKER_ENABLED=false`), 7 bounded Cloud Run Jobs, and Cloud Scheduler is
checked into `deploy/README.md` + `deploy/gcloud/*` (least-privilege IAM,
Secret Manager bindings, `maxInstances=10` example bound for the Supabase
pooler). `apps/api/README.md` now documents `start:task-consumer` and the
three entrypoint commands. Live provisioning is blocked until the operator
supplies project/region/credentials/authorization; artifacts are locally
verified (`typecheck`, `build`, unit tests pass).

## Capability status

| Capability                                  | Status   | Implemented evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Remaining before completion                                                                                                                    |
| ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| API and PostgreSQL foundation               | Complete | NestJS modular API, Prisma migrations, health/readiness endpoints, PostgreSQL constraint tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Continue applying these conventions to later domains                                                                                           |
| Three-product catalog                       | Complete | Stable `BECE`, `WASSCE`, and `NOVDEC_PRIVATE` seed records and catalog endpoint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Products remain unavailable until pricing and stock are configured                                                                             |
| Internal operator authentication backend    | Complete | Passkey enrollment/authentication ceremonies, opaque revocable sessions, logout, bootstrap command, invitation endpoints, rate limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Shared/edge production rate limiting                                                                                                           |
| Administration passkey UI                   | Partial  | Passkey enrollment/login screens, same-origin gateway with HttpOnly session cookie, logout, protected dashboard navigation, Administrator invitation UI, and successful manual enrollment/authentication/invitation testing                                                                                                                                                                                                                                                                                                                                                                                             | Session-expiry and Support invitation-authorization coverage                                                                                   |
| Internal authorization and audit baseline   | Partial  | Administrator/Support RBAC, server-side session checks, append-only audit events for implemented sensitive actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Extend policies and audit coverage to every later administration workflow                                                                      |
| Encrypted inventory intake                  | Complete | Structured manual batch validation, duplicate fingerprints, envelope encryption under an application-held master key, atomic import and audit, an Administrator preview/confirm form, authoritative per-product stock counts, recent batch history, and masked batch detail for Administrator and Support                                                                                                                                                                                                                                                                                                               | Quarantine operations, reservations, configurable low-stock alerts, and master-key recovery exercise                                           |
| Agent identity and tenancy                  | Partial  | Encrypted/fingerprinted Ghana phone storage, individual tenant creation, attempt-limited SMS OTP registration and sign-in, revocable sessions, development SMS adapter, protected workspace UI, server-tracked resumable first-run onboarding modal (store identity, pricing, availability, and final sharing), and audited Administrator suspension/restore API and UI                                                                                                                                                                                                                                                                                                                                                                 | Browser/database flow coverage, production SMS adapter, recovery evidence policy and implementation, and tenant authorization tests            |
| Pricing and agent sales channels            | Complete | Effective pricing and overrides; transactional idempotent writes; immediate and scheduled clamping; agent/admin pricing UI; permanent opaque web identifiers; active-agent attribution API; copy/share controls; public storefront route; PostgreSQL coverage                                                                                                                                                                                                                                                                                                                                                           | Checkout is owned by the later web-sale phase; USSD is deferred post-MVP                                                                       |
| Order and payment foundation                | Partial  | Prisma-managed order, item, payment-attempt, payment-event, reservation, allocation, wallet-ledger, delivery-work, and refund-queue schema; protected guest contacts; immutable snapshots; all-or-nothing reservation; Paystack sandbox/live adapters; raw-body webhook authentication; provider verification; idempotent accepted/failed payment transactions; leased initialization recovery after a committed request crash; durable-lease timeout/reconciliation verification with grace-period reservation release; fresh late-success allocation; and Administrator-approved excess-payment refund queueing       | Administrator refund approval/execution, provider refund reconciliation, and sandbox evidence                                                  |
| Web storefront and fulfillment              | Partial  | Agent-attributed public storefront; guest checkout/review using intentional Paystack-hosted payment-detail collection; server-snapshot pricing; safe status polling; token-gated voucher reveal; same-order retry with fresh attempt/reference/reservation; atomic voucher sale/allocation; exactly-once agent credit; durable SMS/email work; persisted delivery attempts; replay-safe development dispatch; and a no-store public recovery UI                                                                                                                                                                         | Real SMS/email providers, provider reconciliation, and complete end-to-end sandbox delivery evidence                                           |
| Exceptions, recovery, disputes, and refunds | Partial  | Generic real/decoy buyer recovery challenges, immutable delivery-phone OTP verification, attempt-limited ten-minute scoped recovery sessions, audited voucher reveal with envelope decryption, public recovery UI, Administrator-only excess-payment refund queue listing and approval, reasoned audit records, durable submission work, and verified six-check manual recovery evidence on 2026-08-01                                                                                                                                                                                                                  | Paid-order exception resolution, disputes and replacements; Paystack refund submission/reconciliation is deferred to the later exception slate |
| Agent wallet and withdrawals                | Complete | Signed balance and paginated history; database-enforced immutable withdrawal and hold snapshots; fresh principal-bound OTP requests; serializable concurrent-spend protection; Administrator approval/rejection with audit; durable Paystack recipient/transfer submission; merchant OTP; one signed webhook routed across payments, refunds, and transfers; provider verification before idempotent success/failure/reversal settlement; background reconciliation; agent/admin shadcn interfaces; unit, HTTP, and PostgreSQL integration coverage; and product-owner manual acceptance on 2026-08-01                  | Withdrawal status notifications and privacy-safe agent exports remain for later operational enhancement                                        |
| USSD purchase channel                       | Deferred | Removed from MVP by product-owner decision on 2026-08-01                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Reassess after MVP launch evidence                                                                                                             |
| Reporting and operations                    | Partial  | Admin Operations & Finance Dashboard; bounded invariant audit and outbox lease/repair jobs; Stuck Outbox Work Inspector with re-queue controls; Admin reporting endpoints. Deployment packaging for private task-consumer, queue, Jobs, and Scheduler is checked into `deploy/`. Privacy-safe data exports deferred by product-owner decision on 2026-08-02. | PostgreSQL verification and live deployment execution (blocked: no project/region/credentials)                                                    |
| Production readiness                        | Partial  | Security and Paystack provider checks remain covered; HTTP/API isolation, Cloud Tasks OIDC dispatch, private task-consumer (`POST /internal/tasks/outbox`), bounded jobs, honest lint, build, and monorepo typecheck pass. One immutable image and `deploy/gcloud/*` (queue, IAM, Run services, Jobs, Scheduler, Secret Manager) are packaged and locally verified.                                                                                                                                                           | Production SMS/email delivery gateway; live authenticated Cloud Tasks/Cloud Run deployment and staging black-box verification; PostgreSQL verification; CORS origin whitelist (if multi-domain); helmet security headers (recommended) |

## Delivery-phase status

| Phase                                              | Status                | Completion condition                                                                                                                                                        |
| -------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — External readiness                       | External, in progress | Provider feasibility, sandbox access, WAEC authority, and compliance work have owners and evidence                                                                          |
| Phase 1 — Core foundation                          | Partial               | Agent authentication, tenant authorization, outbox/idempotency, and remaining production controls pass the phase exit criteria                                              |
| Phase 2 — Supply, catalog, and agent configuration | Partial               | Agent onboarding, pricing, channels, inventory operations, and concurrent allocation are complete                                                                           |
| Phase 3 — Web sale                                 | Partial               | A sandbox Mobile Money purchase fulfills and credits exactly once                                                                                                           |
| Phase 4 — Recovery and exception handling          | Partial               | Buyer recovery has database and HTTP coverage; the remaining confirmed exception flows must pass integration tests                                                          |
| Phase 5 — Agent finance and portal                 | Complete              | Automated withdrawal concurrency, idempotent settlement, reversal, portal, reconciliation checks, and product-owner manual acceptance passed                                |
| Phase 6 — USSD channel                             | Deferred post-MVP     | Reassess after MVP launch evidence                                                                                                                                          |
| Phase 7 — Reporting and operations                 | Partial               | Admin dashboards, bounded invariant checks, outbox repair, and lease recovery are implemented. Deployment packaging is in `deploy/`; PostgreSQL and live execution evidence remain blocked. Privacy-safe exports deferred. |
| Phase 8 — Production readiness and launch          | Partial               | API isolation, Cloud Tasks OIDC dispatch, private task-consumer, immutable image, bounded jobs, lint, typecheck, build, and unit tests pass. Production delivery adapter, live authenticated deployment, staging black-box verification, PostgreSQL verification, and CORS configuration remain blocked. |

## External work that must run in parallel

- Confirm WAEC vendor/resale and electronic-delivery authority.
- Obtain Paystack sandbox and production onboarding evidence.
- Select SMS and email providers and obtain sandbox specifications.
- Confirm the production domain, WebAuthn relying-party configuration, sender
  identities.
- Progress data-protection, payment-regulatory, tax, accounting, minors, and
  consumer-obligation reviews.

Engineering can continue with provider-owned adapters and test doubles, but a
real end-to-end sale and production launch remain blocked without the relevant
external credentials and approvals.

## Latest verification evidence

As of 2026-09-01 (Plan 004 packaging):

- `pnpm --filter @dashchecker/api typecheck`: pass
- `pnpm --filter @dashchecker/api build` (`prebuild` `prisma generate` + `nest build`): pass, emits `dist/main.js`, `dist/task-main.js`, `dist/job-main.js`
- `pnpm --filter @dashchecker/api test -- --runInBand`: 29 suites, 105 tests pass (task-consumer composition, OIDC verifier, router, dispatcher/publisher, handlers)
- `pnpm typecheck` (monorepo): pass
- `pnpm lint` (honest, no inline suppressions): pass
- `docker build -f Dockerfile .` shape locally verified via `node --check` for all three entrypoints; invalid `JOB_NAME` exits non-zero; health wiring present (`GET /health/live` / `ready`)
- PostgreSQL integration / staging black-box verification: blocked (`TEST_DATABASE_URL` unavailable, no GCP project/region/credentials supplied – see `deploy/README.md` Blocker and `docs/planning/deployment-todo.md` Blocked section)
- Live deployment (queue, Run services, Jobs, Scheduler, image digest): blocked – same authorization gate; packaging in `deploy/gcloud/*` is checked-in and shell-checked only

## Maintenance rule

Every material implementation slice must update this document in the same
change set:

1. move the completed capability to its evidenced status,
2. name exactly one next slice,
3. record any genuine external blocker,
4. link new decision records when implementation resolves an open question,
5. never mark a phase complete before its documented exit criteria pass.

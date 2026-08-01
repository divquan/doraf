# MVP implementation progress

Status: Active tracker  
Last updated: 2026-08-01

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

**Next slice:** complete permanent agent web-link and USSD referral identifiers,
then expose inventory operations in the administration application. Manual
browser verification remains an explicit product-owner handoff.

## Capability status

| Capability | Status | Implemented evidence | Remaining before completion |
| --- | --- | --- | --- |
| API and PostgreSQL foundation | Complete | NestJS modular API, Prisma migrations, health/readiness endpoints, PostgreSQL constraint tests | Continue applying these conventions to later domains |
| Three-product catalog | Complete | Stable `BECE`, `WASSCE`, and `NOVDEC_PRIVATE` seed records and catalog endpoint | Products remain unavailable until pricing and stock are configured |
| Internal operator authentication backend | Complete | Passkey enrollment/authentication ceremonies, opaque revocable sessions, logout, bootstrap command, invitation endpoints, rate limits | Shared/edge production rate limiting |
| Administration passkey UI | Partial | Passkey enrollment/login screens, same-origin gateway with HttpOnly session cookie, logout, protected dashboard navigation, Administrator invitation UI, and successful manual enrollment/authentication/invitation testing | Session-expiry and Support invitation-authorization coverage |
| Internal authorization and audit baseline | Partial | Administrator/Support RBAC, server-side session checks, append-only audit events for implemented sensitive actions | Extend policies and audit coverage to every later administration workflow |
| Encrypted inventory import backend | Complete | Whole-batch CSV validation, duplicate fingerprints, envelope encryption under an application-held master key, atomic import and audit | Administration upload UI, inventory management, quarantine, reservations, low-stock alerts, and master-key recovery exercise |
| Agent identity and tenancy | Partial | Encrypted/fingerprinted Ghana phone storage, individual tenant creation, attempt-limited SMS OTP registration and sign-in, revocable sessions, development SMS adapter, protected workspace UI, and audited Administrator suspension/restore API | Browser/database flow coverage, production SMS adapter, recovery evidence policy and implementation, suspension UI, and tenant authorization tests |
| Pricing and agent sales channels | Partial | Complete pricing slice: effective policies and per-agent overrides, transactional idempotent writes, immediate and scheduled automatic clamping, audit/outbox records, PostgreSQL integration coverage, polished agent price/profit controls, and Administrator/Support pricing controls | Permanent web links and USSD referral codes |
| Order and payment foundation | Not started | Confirmed requirements and state-machine documentation | Orders, snapshots, reservations, payment attempts/events, Paystack adapter, webhook handling, outbox, and idempotency |
| Web storefront and fulfillment | Not started | Confirmed product and flow documentation | Storefront, guest checkout, allocation, SMS/email delivery, and end-to-end sandbox sale |
| Exceptions, recovery, disputes, and refunds | Not started | Confirmed policies and flows | Reconciliation, late/duplicate/reversed payment handling, buyer recovery, replacements, and refunds |
| Agent wallet and withdrawals | Not started | Confirmed append-only ledger decision and withdrawal policy | Ledger, balances, holds, requests, approvals, Paystack transfers, and reconciliation |
| USSD purchase channel | Not started | Confirmed shared-code flow | Provider adapter, menus, replay protection, timeout handling, and shared purchase lifecycle |
| Reporting and operations | Not started | Confirmed metric and reconciliation requirements | Dashboards, queues, invariant checks, daily reconciliation, cases, exports, alerts, and runbooks |
| Production readiness | External | Infrastructure and launch requirements are documented | Provider approvals, compliance evidence, security testing, recovery exercise, training, and go-live sign-off |

## Delivery-phase status

| Phase | Status | Completion condition |
| --- | --- | --- |
| Phase 0 — External readiness | External, in progress | Provider feasibility, sandbox access, WAEC authority, and compliance work have owners and evidence |
| Phase 1 — Core foundation | Partial | Agent authentication, tenant authorization, outbox/idempotency, and remaining production controls pass the phase exit criteria |
| Phase 2 — Supply, catalog, and agent configuration | Partial | Agent onboarding, pricing, channels, inventory operations, and concurrent allocation are complete |
| Phase 3 — Web sale | Not started | A sandbox Mobile Money purchase fulfills and credits exactly once |
| Phase 4 — Recovery and exception handling | Not started | Confirmed exception and recovery flows pass integration tests |
| Phase 5 — Agent finance and portal | Not started | Wallet and withdrawal concurrency and reconciliation criteria pass |
| Phase 6 — USSD channel | Not started | Provider-shaped replay, timeout, and attribution tests pass |
| Phase 7 — Reporting and operations | Not started | A full test period reconciles with owned operational queues |
| Phase 8 — Production readiness and launch | External | Every applicable launch gate has evidence and operator sign-off |

## External work that must run in parallel

- Confirm WAEC vendor/resale and electronic-delivery authority.
- Obtain Paystack sandbox and production onboarding evidence.
- Select SMS, email, and USSD providers and obtain sandbox specifications.
- Confirm the production domain, WebAuthn relying-party configuration, sender
  identities, and USSD code feasibility.
- Progress data-protection, payment-regulatory, tax, accounting, minors, and
  consumer-obligation reviews.

Engineering can continue with provider-owned adapters and test doubles, but a
real end-to-end sale and production launch remain blocked without the relevant
external credentials and approvals.

## Latest verification evidence

As of 2026-08-01, the implemented API slices pass lint, TypeScript checking,
unit tests, HTTP end-to-end tests, PostgreSQL migration/constraint/integration
tests, production build, and Prisma schema-drift detection.

## Maintenance rule

Every material implementation slice must update this document in the same
change set:

1. move the completed capability to its evidenced status,
2. name exactly one next slice,
3. record any genuine external blocker,
4. link new decision records when implementation resolves an open question,
5. never mark a phase complete before its documented exit criteria pass.

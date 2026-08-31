# Dashchecker API

NestJS API for Dashchecker's agent marketplace. Product and architecture requirements
live in [`../../docs/README.md`](../../docs/README.md).

## Local setup

Copy `.env.example` to `.env` and replace the placeholders. Supabase is used
only as PostgreSQL:

- `DATABASE_URL` is the runtime connection, normally the Supabase transaction
  pooler URL.
- `DIRECT_URL` is the direct database connection used by Prisma migrations.

Then run:

```bash
pnpm install
pnpm --filter @dashchecker/api db:generate
pnpm --filter @dashchecker/api db:migrate:deploy
pnpm --filter @dashchecker/api db:seed
pnpm --filter @dashchecker/api start:dev
```

## Scheduled jobs

The HTTP API never starts background polling. Long-running local development
uses the separate worker process:

```bash
pnpm --filter @dashchecker/api start:worker
```

Cloud Run Jobs (or another authenticated scheduler) should invoke the bounded
job entrypoint instead. Each invocation opens the application context, runs
one bounded pass, and exits with a non-zero status if the pass cannot complete:

```bash
JOB_NAME=outbox pnpm --filter @dashchecker/api start:job
JOB_NAME=payment-initialization pnpm --filter @dashchecker/api start:job
JOB_NAME=payment-reconciliation pnpm --filter @dashchecker/api start:job
JOB_NAME=refund-reconciliation pnpm --filter @dashchecker/api start:job
JOB_NAME=withdrawal-reconciliation pnpm --filter @dashchecker/api start:job
JOB_NAME=lease-recovery pnpm --filter @dashchecker/api start:job
JOB_NAME=invariant-audit pnpm --filter @dashchecker/api start:job
```

The job names are allowlisted in `src/job-main.ts`. Configure Cloud Scheduler
to trigger Cloud Run Jobs with the platform's authenticated identity; do not
expose the job command as a public HTTP mutation route. The existing
`start:worker` process remains the local and deliberately operated fallback.

The current HTTP surface is:

- `GET /health/live`
- `GET /health/ready`
- `GET /v1/catalog/products`
- `POST /v1/admin/inventory/imports/preview` (Administrator)
- `POST /v1/admin/inventory/imports` (Administrator)
- `GET /v1/admin/inventory` (Administrator and Support)
- `GET /v1/admin/inventory/batches/:batchId` (Administrator and Support)
- `POST /v1/internal-auth/passkeys/registration/options`
- `POST /v1/internal-auth/passkeys/registration/verify`
- `POST /v1/internal-auth/passkeys/authentication/options`
- `POST /v1/internal-auth/passkeys/authentication/verify`
- `POST /v1/internal-auth/logout`
- `POST /v1/admin/internal-users` (Administrator)
- `POST /v1/admin/internal-users/:userId/enrollment-tokens` (Administrator)
- `POST /v1/admin/agents/:agentId/suspend` (Administrator)
- `POST /v1/admin/agents/:agentId/restore` (Administrator)
- `POST /v1/admin/products/:productId/pricing-policies` (Administrator)
- `POST /v1/admin/products/:productId/agent-overrides/:agentId` (Administrator)
- `POST /v1/admin/products/:productId/status` (Administrator)
- `POST /v1/agent-auth/registration/otp`
- `POST /v1/agent-auth/registration/verify`
- `POST /v1/agent-auth/registration/complete`
- `POST /v1/agent-auth/login/otp`
- `POST /v1/agent-auth/login/verify`
- `GET /v1/agent-auth/session`
- `GET /v1/agent-auth/prices`
- `POST /v1/agent-auth/logout`
- `POST /v1/agent-auth/prices/:productId`
- `GET /v1/agent-auth/sales-channel`
- `GET /v1/agent-wallet/summary` (authenticated agent)
- `GET /v1/agent-wallet/transactions` (authenticated agent)
- `GET /v1/agent-wallet/withdrawals` (authenticated agent)
- `POST /v1/agent-wallet/withdrawals` (authenticated agent, fresh withdrawal token)
- `POST /v1/agent-auth/withdrawals/otp` (authenticated agent)
- `POST /v1/agent-auth/withdrawals/verify` (authenticated agent)
- `GET /v1/admin/withdrawals` (Administrator)
- `POST /v1/admin/withdrawals/:withdrawalId/approve` (Administrator)
- `POST /v1/admin/withdrawals/:withdrawalId/reject` (Administrator)
- `POST /v1/admin/withdrawals/:withdrawalId/finalize-transfer` (Administrator)
- `POST /v1/admin/withdrawals/:withdrawalId/verify-transfer` (Administrator)
- `GET /v1/sales-channels/web/:webSalesId` (public active-agent resolution)
- `POST /v1/sales-channels/web/:webSalesId/orders` (public idempotent checkout)
- `POST /v1/buyer-recovery/request` (public, generic recovery challenge)
- `POST /v1/buyer-recovery/verify` (public, delivery-phone OTP verification)
- `GET /v1/buyer-recovery/vouchers` (short-lived recovery bearer token)

Products are seeded as `UNAVAILABLE`; checkout must not expose them until valid
pricing and inventory exist.

## Inventory import

The inventory import routes require an active, unexpired internal Administrator
session through a bearer token. Support sessions are denied. A committed import
and its audit event are written in the same serializable database transaction.

Internal operators use user-verified discoverable passkeys. Registration and
authentication ceremonies expire after five minutes and are one-time. A valid
assertion issues an opaque eight-hour bearer session; logout, expiry,
suspension, and explicit revocation invalidate it.

Authentication and invitation responses use `Cache-Control: no-store`. The
administration web application must keep the returned bearer token in a secure,
HTTP-only session cookie or server-side session and must not place it in browser
local storage.

Bootstrap the first Administrator only after applying migrations. The command
loads `apps/api/.env` automatically:

```bash
pnpm --filter @dashchecker/api internal:bootstrap-admin -- "Administrator Name"
```

The command refuses to run once any internal user exists and prints one
15-minute enrollment token exactly once. Use it with the registration-options
endpoint, complete the browser WebAuthn ceremony, and send the result to the
registration-verification endpoint. Later operators are invited through the
Administrator-only internal-user endpoint.

Agents register and sign in with Ghana phone numbers and six-digit SMS OTPs.
Phone values are encrypted, indexed only through a keyed fingerprint, and never
returned by the API. In development, sent OTPs are written only to the API
terminal; they are not included in API responses. Production refuses OTP
delivery until a provider-backed SMS adapter is configured. Registration
completion and authenticated sessions use separate short-lived opaque tokens.

Agent suspension and restoration require an Administrator session and a recorded
reason. Each action is serializable and appends an immutable audit event. A
suspended agent can still sign in to their read-only portal. Agent account
recovery is not exposed until its evidence policy is decided.

Pricing policy and override writes are versioned by effective time. When a
currently effective change makes an agent's active retail price invalid, the
price is clamped to the nearest permitted boundary in the same transaction.
Every automatic adjustment receives its own audit and outbox record. All three
pricing write commands require an `Idempotency-Key` header. Future-dated changes
enqueue activation-due work for the separately deployed worker, whose pricing
handler applies the same clamping rules when the event becomes available.

`InventoryImportService` supports validation preview and atomic commit for
structured manual entries containing `serialNumber` and `pin`. The complete set
is rejected when any entry is invalid or duplicates existing inventory. CSV
upload is outside the MVP.

The inventory overview reports authoritative voucher counts by product and
state plus the 25 most recent committed batches. Batch detail returns only
masked serial numbers and PINs with operational state; voucher ciphertext,
fingerprints, and encryption-key material are never projected into these read
responses. Both read routes require an Administrator or Support session and
disable response caching.

Inventory registration uses `InventoryModule.registerMasterKey()` and requires
independent `VOUCHER_MASTER_KEY_BASE64` and `VOUCHER_FINGERPRINT_KEY_BASE64`
runtime secrets. Voucher data keys are generated per batch and wrapped by the
application-held master key. `SESSION_FINGERPRINT_KEY_BASE64` is a separate
secret used to store only HMAC fingerprints of opaque session tokens, never the
bearer tokens.
`INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64` separately protects one-time
operator enrollment tokens.

## Web checkout foundation

Public checkout creates a durable order, one immutable item snapshot per unit,
the first Paystack-shaped payment attempt, and an all-or-nothing voucher
reservation in one serializable transaction. Voucher selection uses
deterministic PostgreSQL row locking with `SKIP LOCKED`; a checkout never
receives a partial quantity. Repeating the same safe `Idempotency-Key` and body
returns the existing order.

Delivery phone, optional delivery email, and synthetic Paystack email are
encrypted before persistence. API responses contain masks only.
Development can temporarily fall back to the agent contact keys and the
Paystack-valid `example.com` sandbox email domain; production requires independent
`ORDER_CONTACT_ENCRYPTION_KEY_BASE64`,
`ORDER_CONTACT_FINGERPRINT_KEY_BASE64`, and a controlled
`PAYSTACK_GUEST_EMAIL_DOMAIN`.

After the reservation commits, the API initializes a Paystack-hosted checkout
and returns its short-lived access code to the storefront. The storefront opens
Paystack InlineJS as a popup; payment details stay inside Paystack's UI.
`PAYSTACK_MODE=sandbox` is required outside production and requires an
`sk_test_` key. Live mode is rejected outside `NODE_ENV=production` and
requires an `sk_live_` key. There is no simulated local payment adapter.

Paystack webhook processing uses the exact raw request body and the documented
HMAC-SHA512 signature. A reported success is verified against Paystack and must
match the stored reference, amount, and currency. One serializable transaction
then accepts the payment, sells and allocates every reserved voucher, appends
one wallet sale credit, and creates durable SMS and optional email work.
Duplicate processing returns the existing effects. Terminal failure releases
the reservation. A definitive Paystack initialization rejection releases the
reservation immediately. Network timeouts
and provider 5xx responses remain in reconciliation because Dashchecker cannot safely
assume that no payment prompt was sent. The API logs the Paystack HTTP status
and a redacted provider reason alongside the payment reference.

The same configured webhook endpoint receives Paystack transfer events. Transfer
events only trigger provider verification; ledger settlement uses the verified
reference, amount, currency, and status. There is no separate transfer webhook.

Initialized attempts still need the continuously running timeout verification
and reconciliation worker. Delivery provider calls are also a later slice; the
current transaction commits durable delivery messages and outbox work only.

## Buyer voucher recovery

The buyer-facing `/recover` flow accepts the high-entropy order reference from a
completed paid order and sends a one-time code to the immutable SMS delivery
number. The request response is deliberately generic and has the same shape for
known and unknown references. Successful verification issues a ten-minute,
single-order bearer token that can reveal only that order's checker product and
decrypted serial-number/PIN pairs.

Recovery challenges have expiry and attempt limits. Requests, successful
verification, and voucher reveals are audited without voucher secrets or buyer
contact data. All recovery routes disable caching and are rate-limited. The web
application keeps the short-lived bearer token only in component memory and
never puts it in storage or a URL.

In development, the recovery code is written only to the API terminal by the
development SMS adapter. Production recovery requires a provider-backed SMS
adapter; if delivery is unavailable, the public request still returns its
generic response and logs only a safe challenge identifier.

To use the Paystack sandbox locally, obtain a test secret key from the Paystack
dashboard and set:

```dotenv
PAYSTACK_MODE=sandbox
PAYSTACK_SECRET_KEY=sk_test_replace-me
```

Configure the Paystack dashboard webhook URL as
`https://<public-api-host>/v1/payments/paystack/webhook`. A tunnel is required
when Paystack needs to reach a locally running API.

## Agent wallet, ledger, and withdrawals

The agent-wallet endpoints provide authenticated agents with their balance,
paginated transaction history, withdrawal request form, and withdrawal history.

- **Signed Decimal String Contract:** All monetary fields (`ledgerBalanceMinor`, `activeHoldsMinor`, `withdrawableMinor`, `negativeBalanceMinor`, `amountMinor`) are returned as signed integer pesewa strings (e.g. `"2500"`, `"-500"`). Currency presentation formatting (`GHS 25.00`) is handled in the frontend.
- **Atomic holds:** A fresh Dashchecker OTP authorizes one request. A serializable transaction rechecks funds and places the net payout plus GHS 1 fee on hold, preventing concurrent overspend.
- **Approval and transfer:** Administrator approval revalidates the agent and wallet, then durable outbox work creates or reuses the current-phone Paystack recipient and initiates a uniquely referenced GHS transfer. Merchant transfer OTP can be completed from the administration queue.
- **Settlement:** Verified success appends payout and fee debits and consumes the hold. Failure releases it. A later verified reversal appends an idempotent compensation credit without changing prior ledger rows.
- **No GET Initialization:** Querying balance or transactions for an agent without wallet entries returns a zero summary and empty history without creating database records.
- **Append-Only Immutability:** `ledger_entry` records are protected by a PostgreSQL trigger `prevent_ledger_entry_update_or_delete` rejecting any `UPDATE` or `DELETE` attempt at the database engine level.

## Verification

```bash
pnpm --filter @dashchecker/api lint
pnpm --filter @dashchecker/api typecheck
pnpm --filter @dashchecker/api test --runInBand
pnpm --filter @dashchecker/api test:e2e --runInBand
pnpm --filter @dashchecker/api build
```

Database constraints run against an isolated local PostgreSQL container:

```bash
docker compose -f apps/api/compose.test.yml -p dashchecker-api-test up -d --wait

DIRECT_URL=postgresql://dashchecker_test:dashchecker_test@127.0.0.1:55434/dashchecker_test \
  pnpm --filter @dashchecker/api db:migrate:deploy

TEST_DATABASE_URL=postgresql://dashchecker_test:dashchecker_test@127.0.0.1:55434/dashchecker_test \
  pnpm --filter @dashchecker/api test:database

docker compose -f apps/api/compose.test.yml -p dashchecker-api-test down
```

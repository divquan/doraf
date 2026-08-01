# Doraf API

NestJS API for Doraf's agent marketplace. Product and architecture requirements
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
pnpm --filter @doraf/api db:generate
pnpm --filter @doraf/api db:migrate:deploy
pnpm --filter @doraf/api db:seed
pnpm --filter @doraf/api start:dev
```

The current HTTP surface is:

- `GET /health/live`
- `GET /health/ready`
- `GET /v1/catalog/products`
- `POST /v1/admin/inventory/imports/preview` (Administrator)
- `POST /v1/admin/inventory/imports` (Administrator)
- `POST /v1/internal-auth/passkeys/registration/options`
- `POST /v1/internal-auth/passkeys/registration/verify`
- `POST /v1/internal-auth/passkeys/authentication/options`
- `POST /v1/internal-auth/passkeys/authentication/verify`
- `POST /v1/internal-auth/logout`
- `POST /v1/admin/internal-users` (Administrator)
- `POST /v1/admin/internal-users/:userId/enrollment-tokens` (Administrator)
- `POST /v1/admin/agents/:agentId/suspend` (Administrator)
- `POST /v1/admin/agents/:agentId/restore` (Administrator)
- `POST /v1/agent-auth/registration/otp`
- `POST /v1/agent-auth/registration/verify`
- `POST /v1/agent-auth/registration/complete`
- `POST /v1/agent-auth/login/otp`
- `POST /v1/agent-auth/login/verify`
- `GET /v1/agent-auth/session`
- `POST /v1/agent-auth/logout`

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
pnpm --filter @doraf/api internal:bootstrap-admin -- "Administrator Name"
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
suspended agent can still sign in to their read-only portal; account recovery is
not exposed until its documented evidence and withdrawal-hold policy is decided.

`InventoryImportService` supports validation preview and atomic commit for CSV
files with this exact header:

```csv
serial_number,pin
ABC123456,012345678912
```

Inventory registration uses `InventoryModule.registerMasterKey()` and requires
independent `VOUCHER_MASTER_KEY_BASE64` and `VOUCHER_FINGERPRINT_KEY_BASE64`
runtime secrets. Voucher data keys are generated per batch and wrapped by the
application-held master key. `SESSION_FINGERPRINT_KEY_BASE64` is a separate
secret used to store only HMAC fingerprints of opaque session tokens, never the
bearer tokens.
`INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64` separately protects one-time
operator enrollment tokens.

## Verification

```bash
pnpm --filter @doraf/api lint
pnpm --filter @doraf/api typecheck
pnpm --filter @doraf/api test --runInBand
pnpm --filter @doraf/api test:e2e --runInBand
pnpm --filter @doraf/api build
```

Database constraints run against an isolated local PostgreSQL container:

```bash
docker compose -f apps/api/compose.test.yml -p doraf-api-test up -d --wait

DIRECT_URL=postgresql://doraf_test:doraf_test@127.0.0.1:55434/doraf_test \
  pnpm --filter @doraf/api db:migrate:deploy

DIRECT_URL=postgresql://doraf_test:doraf_test@127.0.0.1:55434/doraf_test \
DATABASE_URL=postgresql://doraf_test:doraf_test@127.0.0.1:55434/doraf_test \
  pnpm --filter @doraf/api db:seed

TEST_DATABASE_URL=postgresql://doraf_test:doraf_test@127.0.0.1:55434/doraf_test \
  pnpm --filter @doraf/api test:database

docker compose -f apps/api/compose.test.yml -p doraf-api-test down
```

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

Products are seeded as `UNAVAILABLE`; checkout must not expose them until valid
pricing and inventory exist.

## Inventory import

The inventory feature currently provides a service boundary, not a public HTTP
route. It remains deliberately unmounted until Administrator authentication and
authorization are implemented.

`InventoryImportService` supports validation preview and atomic commit for CSV
files with this exact header:

```csv
serial_number,pin
ABC123456,012345678912
```

Production registration uses `InventoryModule.registerGcp()` and requires
`VOUCHER_KMS_KEY_NAME`, `VOUCHER_FINGERPRINT_KEY_BASE64`, and Google Application
Default Credentials. Voucher data keys are generated per batch and wrapped by
Google Cloud KMS.

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

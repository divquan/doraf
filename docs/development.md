# Local development

The root [Compose file](../compose.yml) runs only a local PostgreSQL database.
Run the API and web applications on the host through Turborepo. The database
credentials below are development-only values.

## Start PostgreSQL

```sh
docker compose up -d
```

- PostgreSQL: `postgresql://dashchecker:dashchecker@localhost:5432/dashchecker`

The database is stored in the named `postgres-data` volume. Stop the stack with
`docker compose down`. To remove all local Compose database data, use
`docker compose down --volumes`.

## Create the first local Administrator

After PostgreSQL is available, configure `apps/api/.env` from its example and
apply the local schema and seeds:

```sh
pnpm --filter @dashchecker/api db:migrate:deploy
pnpm --filter @dashchecker/api db:seed
```

Generate a separate value for every placeholder key in `apps/api/.env` before
starting the API. Run this once per key:

```sh
openssl rand -base64 32
```

The voucher, session, enrollment, agent-phone, and OTP keys must remain distinct.
They are local development secrets; never commit them. Real voucher imports
require the recovery procedure in
[ADR-0012](decisions/ADR-0012-use-an-application-held-voucher-master-key.md).

Then start all application development servers:

```sh
pnpm dev
```

After the API starts, create the single bootstrap enrollment token:

```sh
pnpm --filter @dashchecker/api internal:bootstrap-admin "Your Name"
```

Open http://localhost:3001/enroll, paste that token, and create a passkey. The
token is one-time and short-lived. After enrollment, use
http://localhost:3001/login. The bootstrap command deliberately refuses to run
after an internal user exists; create later operators through the authenticated
Administration dashboard.

The agent portal and public attributed storefront run at http://localhost:3002 and
http://localhost:3003 respectively. Set `DASHCHECKER_STOREFRONT_URL=http://localhost:3003`
in `apps/agent/.env` when overriding the example environment; this is the base
URL the agent portal uses to build buyer-facing sales links. The legacy
`DASHCHECKER_AGENT_WEB_URL` is still accepted as a fallback. In development, sent OTPs are
written only to the API terminal so registration and sign-in can be tested
without an SMS account. They are never returned to or displayed by the agent
application. Production OTP requests fail closed until the selected SMS provider
adapter is configured.

## Reset local data

```sh
docker compose down --volumes
docker compose up -d
```

This deletes only the local Compose database volume. Never use it with a
production database or provider credentials.

`pnpm dev` starts the API on port 3000, the administration app on port 3001,
and the agent app on port 3002. The API uses `nest start --watch`, so it reloads
after server-side changes. Its startup also regenerates Prisma Client, so a
fresh dependency install does not require a separate generation command.

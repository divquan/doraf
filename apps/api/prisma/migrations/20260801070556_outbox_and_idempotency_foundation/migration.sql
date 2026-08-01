-- CreateEnum
CREATE TYPE "outbox_state" AS ENUM ('PENDING', 'CLAIMED', 'DISPATCHED', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(160) NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "state" "outbox_state" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(6),
    "claim_token" UUID,
    "dispatched_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_event_identity_not_blank" CHECK (
        length(btrim("event_type")) > 0 AND length(btrim("aggregate_type")) > 0 AND length(btrim("aggregate_id")) > 0
    ),
    CONSTRAINT "outbox_event_version_positive" CHECK ("aggregate_version" > 0),
    CONSTRAINT "outbox_event_attempt_count_nonnegative" CHECK ("attempt_count" >= 0),
    CONSTRAINT "outbox_event_claim_state_valid" CHECK (
        ("state" = 'CLAIMED') = ("claimed_at" IS NOT NULL AND "claim_token" IS NOT NULL)
    ),
    CONSTRAINT "outbox_event_dispatch_state_valid" CHECK (
        ("state" = 'DISPATCHED') = ("dispatched_at" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "request_fingerprint" BYTEA NOT NULL,
    "outcome_reference" VARCHAR(160),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_record_identity_not_blank" CHECK (
        length(btrim("scope")) > 0 AND length(btrim("key")) > 0 AND length(btrim("operation")) > 0
    ),
    CONSTRAINT "idempotency_record_fingerprint_not_empty" CHECK (octet_length("request_fingerprint") > 0),
    CONSTRAINT "idempotency_record_valid_expiry" CHECK ("expires_at" > "created_at")
);

-- CreateIndex
CREATE INDEX "outbox_event_state_available_at_idx" ON "outbox_event"("state", "available_at");

-- CreateIndex
CREATE INDEX "outbox_event_aggregate_type_aggregate_id_idx" ON "outbox_event"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_aggregate_type_aggregate_id_aggregate_version__key" ON "outbox_event"("aggregate_type", "aggregate_id", "aggregate_version", "event_type");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_scope_key_key" ON "idempotency_record"("scope", "key");

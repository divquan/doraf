CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE "agent_status" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'UNAVAILABLE');

CREATE TABLE "agent_tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone_ciphertext" BYTEA NOT NULL,
    "phone_fingerprint" BYTEA NOT NULL,
    "phone_mask" VARCHAR(32) NOT NULL,
    "encryption_key_id" VARCHAR(100) NOT NULL,
    "format_version" INTEGER NOT NULL DEFAULT 1,
    "status" "agent_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "agent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "agent_phone_ciphertext_not_empty" CHECK (octet_length("phone_ciphertext") > 0),
    CONSTRAINT "agent_phone_fingerprint_not_empty" CHECK (octet_length("phone_fingerprint") > 0),
    CONSTRAINT "agent_format_version_positive" CHECK ("format_version" > 0),
    CONSTRAINT "agent_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "scope_disclosure" TEXT NOT NULL,
    "disclosure_version" INTEGER NOT NULL DEFAULT 1,
    "status" "product_status" NOT NULL DEFAULT 'UNAVAILABLE',
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "product_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "product_scope_disclosure_not_blank" CHECK (length(btrim("scope_disclosure")) > 0),
    CONSTRAINT "product_disclosure_version_positive" CHECK ("disclosure_version" > 0),
    CONSTRAINT "product_display_order_positive" CHECK ("display_order" > 0)
);

CREATE TABLE "product_pricing_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "base_price_minor" BIGINT NOT NULL,
    "maximum_retail_price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_pricing_policy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_pricing_policy_nonnegative" CHECK ("base_price_minor" >= 0 AND "maximum_retail_price_minor" >= 0),
    CONSTRAINT "product_pricing_policy_valid_range" CHECK ("maximum_retail_price_minor" >= "base_price_minor"),
    CONSTRAINT "product_pricing_policy_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "product_pricing_policy_valid_window" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
    CONSTRAINT "product_pricing_policy_reason_not_blank" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "agent_pricing_override" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "base_price_minor" BIGINT,
    "maximum_retail_price_minor" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "agent_pricing_override_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_pricing_override_has_value" CHECK ("base_price_minor" IS NOT NULL OR "maximum_retail_price_minor" IS NOT NULL),
    CONSTRAINT "agent_pricing_override_nonnegative" CHECK (COALESCE("base_price_minor", 0) >= 0 AND COALESCE("maximum_retail_price_minor", 0) >= 0),
    CONSTRAINT "agent_pricing_override_local_range" CHECK ("base_price_minor" IS NULL OR "maximum_retail_price_minor" IS NULL OR "maximum_retail_price_minor" >= "base_price_minor"),
    CONSTRAINT "agent_pricing_override_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "agent_pricing_override_valid_window" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
    CONSTRAINT "agent_pricing_override_reason_not_blank" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "agent_product_price" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "retail_price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "agent_product_price_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_product_price_nonnegative" CHECK ("retail_price_minor" >= 0),
    CONSTRAINT "agent_product_price_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "agent_product_price_version_positive" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "agent_tenant_id_key" ON "agent"("tenant_id");
CREATE UNIQUE INDEX "agent_phone_fingerprint_key" ON "agent"("phone_fingerprint");
CREATE INDEX "agent_status_idx" ON "agent"("status");
CREATE UNIQUE INDEX "product_code_key" ON "product"("code");
CREATE INDEX "product_status_display_order_idx" ON "product"("status", "display_order");
CREATE INDEX "product_pricing_policy_product_id_effective_from_idx" ON "product_pricing_policy"("product_id", "effective_from");
CREATE INDEX "agent_pricing_override_agent_id_product_id_effective_from_idx" ON "agent_pricing_override"("agent_id", "product_id", "effective_from");
CREATE UNIQUE INDEX "agent_product_price_agent_id_product_id_key" ON "agent_product_price"("agent_id", "product_id");
CREATE INDEX "agent_product_price_product_id_idx" ON "agent_product_price"("product_id");

ALTER TABLE "product_pricing_policy"
    ADD CONSTRAINT "product_pricing_policy_no_overlap"
    EXCLUDE USING gist (
        "product_id" WITH =,
        tstzrange("effective_from", COALESCE("effective_to", 'infinity'::timestamptz), '[)') WITH &&
    );

ALTER TABLE "agent_pricing_override"
    ADD CONSTRAINT "agent_pricing_override_no_overlap"
    EXCLUDE USING gist (
        "agent_id" WITH =,
        "product_id" WITH =,
        tstzrange("effective_from", COALESCE("effective_to", 'infinity'::timestamptz), '[)') WITH &&
    );

ALTER TABLE "agent"
    ADD CONSTRAINT "agent_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agent_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_pricing_policy"
    ADD CONSTRAINT "product_pricing_policy_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_pricing_override"
    ADD CONSTRAINT "agent_pricing_override_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_pricing_override"
    ADD CONSTRAINT "agent_pricing_override_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_product_price"
    ADD CONSTRAINT "agent_product_price_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_product_price"
    ADD CONSTRAINT "agent_product_price_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

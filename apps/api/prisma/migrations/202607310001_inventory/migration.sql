CREATE TYPE "voucher_availability" AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'QUARANTINED',
    'VOID'
);

CREATE TYPE "voucher_dispute_disposition" AS ENUM (
    'NONE',
    'REPLACED',
    'REFUNDED'
);

CREATE TABLE "inventory_batch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "vendor_name" VARCHAR(160) NOT NULL,
    "vendor_reference" VARCHAR(160) NOT NULL,
    "acquisition_date" DATE NOT NULL,
    "unit_acquisition_cost_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "source_row_count" INTEGER NOT NULL,
    "accepted_row_count" INTEGER NOT NULL,
    "encrypted_data_key" BYTEA NOT NULL,
    "kms_key_version" VARCHAR(300) NOT NULL,
    "crypto_version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_actor_id" UUID NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_batch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_batch_vendor_name_not_blank" CHECK (length(btrim("vendor_name")) > 0),
    CONSTRAINT "inventory_batch_vendor_reference_not_blank" CHECK (length(btrim("vendor_reference")) > 0),
    CONSTRAINT "inventory_batch_cost_nonnegative" CHECK ("unit_acquisition_cost_minor" >= 0),
    CONSTRAINT "inventory_batch_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "inventory_batch_all_rows_accepted" CHECK (
        "source_row_count" > 0
        AND "accepted_row_count" = "source_row_count"
    ),
    CONSTRAINT "inventory_batch_encrypted_key_not_empty" CHECK (octet_length("encrypted_data_key") > 0),
    CONSTRAINT "inventory_batch_kms_key_not_blank" CHECK (length(btrim("kms_key_version")) > 0),
    CONSTRAINT "inventory_batch_crypto_version_positive" CHECK ("crypto_version" > 0)
);

COMMENT ON TABLE "inventory_batch" IS
    'Only successfully committed atomic imports are persisted. Failed previews create no batch.';

CREATE TABLE "voucher" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "serial_ciphertext" BYTEA NOT NULL,
    "serial_nonce" BYTEA NOT NULL,
    "serial_auth_tag" BYTEA NOT NULL,
    "serial_fingerprint" BYTEA NOT NULL,
    "serial_mask" VARCHAR(64) NOT NULL,
    "serial_key_version" VARCHAR(300) NOT NULL,
    "pin_ciphertext" BYTEA NOT NULL,
    "pin_nonce" BYTEA NOT NULL,
    "pin_auth_tag" BYTEA NOT NULL,
    "pin_fingerprint" BYTEA NOT NULL,
    "pin_mask" VARCHAR(32) NOT NULL,
    "pin_key_version" VARCHAR(300) NOT NULL,
    "crypto_version" INTEGER NOT NULL DEFAULT 1,
    "availability" "voucher_availability" NOT NULL DEFAULT 'AVAILABLE',
    "dispute_disposition" "voucher_dispute_disposition" NOT NULL DEFAULT 'NONE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "voucher_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "voucher_serial_ciphertext_not_empty" CHECK (octet_length("serial_ciphertext") > 0),
    CONSTRAINT "voucher_serial_nonce_length" CHECK (octet_length("serial_nonce") = 12),
    CONSTRAINT "voucher_serial_auth_tag_length" CHECK (octet_length("serial_auth_tag") = 16),
    CONSTRAINT "voucher_serial_fingerprint_length" CHECK (octet_length("serial_fingerprint") = 32),
    CONSTRAINT "voucher_serial_mask_not_blank" CHECK (length(btrim("serial_mask")) > 0),
    CONSTRAINT "voucher_serial_key_not_blank" CHECK (length(btrim("serial_key_version")) > 0),
    CONSTRAINT "voucher_pin_ciphertext_not_empty" CHECK (octet_length("pin_ciphertext") > 0),
    CONSTRAINT "voucher_pin_nonce_length" CHECK (octet_length("pin_nonce") = 12),
    CONSTRAINT "voucher_pin_auth_tag_length" CHECK (octet_length("pin_auth_tag") = 16),
    CONSTRAINT "voucher_pin_fingerprint_length" CHECK (octet_length("pin_fingerprint") = 32),
    CONSTRAINT "voucher_pin_mask_not_blank" CHECK (length(btrim("pin_mask")) > 0),
    CONSTRAINT "voucher_pin_key_not_blank" CHECK (length(btrim("pin_key_version")) > 0),
    CONSTRAINT "voucher_crypto_version_positive" CHECK ("crypto_version" > 0),
    CONSTRAINT "voucher_version_positive" CHECK ("version" > 0),
    CONSTRAINT "voucher_disposition_requires_sale" CHECK (
        "dispute_disposition" = 'NONE' OR "availability" = 'SOLD'
    )
);

CREATE TABLE "inventory_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "voucher_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "previous_availability" "voucher_availability",
    "resulting_availability" "voucher_availability" NOT NULL,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" VARCHAR(160) NOT NULL,
    "actor_id" UUID,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_event_type_not_blank" CHECK (length(btrim("event_type")) > 0),
    CONSTRAINT "inventory_event_source_type_not_blank" CHECK (length(btrim("source_type")) > 0),
    CONSTRAINT "inventory_event_source_id_not_blank" CHECK (length(btrim("source_id")) > 0)
);

CREATE UNIQUE INDEX "inventory_batch_id_product_id_key"
    ON "inventory_batch"("id", "product_id");
CREATE INDEX "inventory_batch_product_id_acquisition_date_imported_at_idx"
    ON "inventory_batch"("product_id", "acquisition_date", "imported_at");
CREATE UNIQUE INDEX "voucher_serial_fingerprint_key" ON "voucher"("serial_fingerprint");
CREATE UNIQUE INDEX "voucher_pin_fingerprint_key" ON "voucher"("pin_fingerprint");
CREATE INDEX "voucher_product_id_availability_batch_id_created_at_idx"
    ON "voucher"("product_id", "availability", "batch_id", "created_at");
CREATE INDEX "voucher_batch_id_idx" ON "voucher"("batch_id");
CREATE UNIQUE INDEX "inventory_event_voucher_id_source_type_source_id_key"
    ON "inventory_event"("voucher_id", "source_type", "source_id");
CREATE INDEX "inventory_event_voucher_id_created_at_idx"
    ON "inventory_event"("voucher_id", "created_at");
CREATE INDEX "inventory_event_event_type_created_at_idx"
    ON "inventory_event"("event_type", "created_at");

ALTER TABLE "inventory_batch"
    ADD CONSTRAINT "inventory_batch_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "voucher"
    ADD CONSTRAINT "voucher_batch_id_product_id_fkey"
    FOREIGN KEY ("batch_id", "product_id") REFERENCES "inventory_batch"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "voucher"
    ADD CONSTRAINT "voucher_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_event"
    ADD CONSTRAINT "inventory_event_voucher_id_fkey"
    FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "protect_voucher_immutable_fields"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."batch_id" IS DISTINCT FROM OLD."batch_id"
        OR NEW."product_id" IS DISTINCT FROM OLD."product_id"
        OR NEW."serial_ciphertext" IS DISTINCT FROM OLD."serial_ciphertext"
        OR NEW."serial_nonce" IS DISTINCT FROM OLD."serial_nonce"
        OR NEW."serial_auth_tag" IS DISTINCT FROM OLD."serial_auth_tag"
        OR NEW."serial_fingerprint" IS DISTINCT FROM OLD."serial_fingerprint"
        OR NEW."serial_mask" IS DISTINCT FROM OLD."serial_mask"
        OR NEW."serial_key_version" IS DISTINCT FROM OLD."serial_key_version"
        OR NEW."pin_ciphertext" IS DISTINCT FROM OLD."pin_ciphertext"
        OR NEW."pin_nonce" IS DISTINCT FROM OLD."pin_nonce"
        OR NEW."pin_auth_tag" IS DISTINCT FROM OLD."pin_auth_tag"
        OR NEW."pin_fingerprint" IS DISTINCT FROM OLD."pin_fingerprint"
        OR NEW."pin_mask" IS DISTINCT FROM OLD."pin_mask"
        OR NEW."pin_key_version" IS DISTINCT FROM OLD."pin_key_version"
        OR NEW."crypto_version" IS DISTINCT FROM OLD."crypto_version"
    THEN
        RAISE EXCEPTION 'voucher identity and protected values are immutable'
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD."availability" = 'SOLD'
        AND NEW."availability" <> 'SOLD'
    THEN
        RAISE EXCEPTION 'sold voucher availability is terminal'
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD."availability" = 'VOID'
        AND NEW."availability" <> 'VOID'
    THEN
        RAISE EXCEPTION 'void voucher availability is terminal'
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD."dispute_disposition" <> 'NONE'
        AND NEW."dispute_disposition" <> OLD."dispute_disposition"
    THEN
        RAISE EXCEPTION 'voucher dispute disposition is terminal'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "voucher_protect_immutable_fields"
BEFORE UPDATE ON "voucher"
FOR EACH ROW EXECUTE FUNCTION "protect_voucher_immutable_fields"();

CREATE FUNCTION "reject_inventory_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'inventory events are append-only'
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "inventory_event_append_only"
BEFORE UPDATE OR DELETE ON "inventory_event"
FOR EACH ROW EXECUTE FUNCTION "reject_inventory_event_mutation"();

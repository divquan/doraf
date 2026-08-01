-- CreateEnum
CREATE TYPE "order_channel_type" AS ENUM ('WEB');

-- CreateEnum
CREATE TYPE "order_payment_state" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED');

-- CreateEnum
CREATE TYPE "order_fulfillment_state" AS ENUM ('PENDING', 'COMPLETE', 'EXCEPTION', 'REFUNDED', 'PARTIALLY_REPLACED');

-- CreateEnum
CREATE TYPE "order_item_fulfillment_state" AS ENUM ('PENDING', 'COMPLETE', 'EXCEPTION', 'REFUNDED');

-- CreateEnum
CREATE TYPE "inventory_reservation_state" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "payment_attempt_state" AS ENUM ('CREATED', 'PENDING_AUTHORIZATION', 'VERIFYING', 'RECONCILING', 'SUCCESS', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "payment_attempt_classification" AS ENUM ('PENDING', 'ACCEPTED', 'EXCESS');

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_reference" VARCHAR(32) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "channel_type" "order_channel_type" NOT NULL,
    "channel_id_snapshot" VARCHAR(80) NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "base_total_minor" BIGINT NOT NULL,
    "retail_total_minor" BIGINT NOT NULL,
    "agent_profit_total_minor" BIGINT NOT NULL,
    "delivery_phone_ciphertext" BYTEA NOT NULL,
    "delivery_phone_fingerprint" BYTEA NOT NULL,
    "delivery_phone_mask" VARCHAR(32) NOT NULL,
    "delivery_email_ciphertext" BYTEA,
    "delivery_email_fingerprint" BYTEA,
    "delivery_email_mask" VARCHAR(160),
    "payer_phone_ciphertext" BYTEA NOT NULL,
    "payer_phone_fingerprint" BYTEA NOT NULL,
    "payer_phone_mask" VARCHAR(32) NOT NULL,
    "payer_network" VARCHAR(40) NOT NULL,
    "contact_encryption_key_id" VARCHAR(100) NOT NULL,
    "contact_format_version" INTEGER NOT NULL DEFAULT 1,
    "price_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_payment_attempt_id" UUID,
    "payment_state" "order_payment_state" NOT NULL DEFAULT 'UNPAID',
    "fulfillment_state" "order_fulfillment_state" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_quantity_allowed" CHECK ("quantity" BETWEEN 1 AND 5),
    CONSTRAINT "order_currency_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "order_amounts_valid" CHECK (
        "base_total_minor" >= 0 AND
        "agent_profit_total_minor" >= 0 AND
        "retail_total_minor" = "base_total_minor" + "agent_profit_total_minor"
    ),
    CONSTRAINT "order_contact_email_complete" CHECK (
        ("delivery_email_ciphertext" IS NULL AND "delivery_email_fingerprint" IS NULL AND "delivery_email_mask" IS NULL) OR
        ("delivery_email_ciphertext" IS NOT NULL AND "delivery_email_fingerprint" IS NOT NULL AND "delivery_email_mask" IS NOT NULL)
    ),
    CONSTRAINT "order_identity_not_blank" CHECK (
        length(btrim("public_reference")) > 0 AND
        length(btrim("channel_id_snapshot")) > 0 AND
        length(btrim("payer_network")) > 0 AND
        length(btrim("contact_encryption_key_id")) > 0
    ),
    CONSTRAINT "order_version_positive" CHECK ("version" > 0),
    CONSTRAINT "order_contact_format_version_positive" CHECK ("contact_format_version" > 0),
    CONSTRAINT "order_price_expiry_valid" CHECK ("price_expires_at" > "created_at")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "base_unit_price_minor" BIGINT NOT NULL,
    "retail_unit_price_minor" BIGINT NOT NULL,
    "agent_profit_unit_minor" BIGINT NOT NULL,
    "fulfillment_state" "order_item_fulfillment_state" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_item_position_allowed" CHECK ("position" BETWEEN 1 AND 5),
    CONSTRAINT "order_item_amounts_valid" CHECK (
        "base_unit_price_minor" >= 0 AND
        "agent_profit_unit_minor" >= 0 AND
        "retail_unit_price_minor" = "base_unit_price_minor" + "agent_profit_unit_minor"
    )
);

-- CreateTable
CREATE TABLE "payment_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL DEFAULT 'PAYSTACK',
    "provider_reference" VARCHAR(80) NOT NULL,
    "synthetic_email_ciphertext" BYTEA NOT NULL,
    "synthetic_email_mask" VARCHAR(160) NOT NULL,
    "expected_amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "state" "payment_attempt_state" NOT NULL DEFAULT 'CREATED',
    "classification" "payment_attempt_classification" NOT NULL DEFAULT 'PENDING',
    "provider_transaction_id" VARCHAR(120),
    "authorization_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "next_reconciliation_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_attempt_number_allowed" CHECK ("attempt_number" BETWEEN 1 AND 3),
    CONSTRAINT "payment_attempt_amount_nonnegative" CHECK ("expected_amount_minor" >= 0),
    CONSTRAINT "payment_attempt_currency_ghs" CHECK ("currency" = 'GHS'),
    CONSTRAINT "payment_attempt_identity_not_blank" CHECK (
        length(btrim("provider")) > 0 AND
        length(btrim("provider_reference")) > 0
    ),
    CONSTRAINT "payment_attempt_version_positive" CHECK ("version" > 0),
    CONSTRAINT "payment_attempt_authorization_expiry_valid" CHECK ("authorization_expires_at" > "created_at")
);

-- CreateTable
CREATE TABLE "inventory_reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "state" "inventory_reservation_state" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_reservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_reservation_version_positive" CHECK ("version" > 0),
    CONSTRAINT "inventory_reservation_expiry_valid" CHECK ("expires_at" > "created_at")
);

-- CreateTable
CREATE TABLE "inventory_reservation_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservation_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_public_reference_key" ON "order"("public_reference");

-- CreateIndex
CREATE UNIQUE INDEX "order_accepted_payment_attempt_id_key" ON "order"("accepted_payment_attempt_id");

-- CreateIndex
CREATE INDEX "order_agent_id_created_at_idx" ON "order"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "order_tenant_id_created_at_idx" ON "order"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "order_product_id_created_at_idx" ON "order"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "order_item_product_id_created_at_idx" ON "order_item"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_order_id_position_key" ON "order_item"("order_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempt_provider_reference_key" ON "payment_attempt"("provider_reference");

-- CreateIndex
CREATE INDEX "payment_attempt_state_next_reconciliation_at_idx" ON "payment_attempt"("state", "next_reconciliation_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempt_order_id_attempt_number_key" ON "payment_attempt"("order_id", "attempt_number");

CREATE UNIQUE INDEX "payment_attempt_one_nonterminal_per_order"
ON "payment_attempt"("order_id")
WHERE "state" IN ('CREATED', 'PENDING_AUTHORIZATION', 'VERIFYING', 'RECONCILING');

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_payment_attempt_id_key" ON "inventory_reservation"("payment_attempt_id");

-- CreateIndex
CREATE INDEX "inventory_reservation_state_expires_at_idx" ON "inventory_reservation"("state", "expires_at");

-- CreateIndex
CREATE INDEX "inventory_reservation_order_id_created_at_idx" ON "inventory_reservation"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_reservation_item_voucher_id_idx" ON "inventory_reservation_item"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_item_reservation_id_voucher_id_key" ON "inventory_reservation_item"("reservation_id", "voucher_id");

-- Serializes reservation-item insertion on the voucher and prevents a voucher
-- from appearing in more than one ACTIVE reservation while retaining released
-- reservation history.
CREATE FUNCTION enforce_one_active_reservation_per_voucher()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1 FROM "voucher" WHERE "id" = NEW."voucher_id" FOR UPDATE;
    IF EXISTS (
        SELECT 1
        FROM "inventory_reservation_item" existing_item
        JOIN "inventory_reservation" existing_reservation
          ON existing_reservation."id" = existing_item."reservation_id"
        WHERE existing_item."voucher_id" = NEW."voucher_id"
          AND existing_reservation."state" = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'voucher already belongs to an active reservation'
          USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_reservation_item_one_active
BEFORE INSERT ON "inventory_reservation_item"
FOR EACH ROW EXECUTE FUNCTION enforce_one_active_reservation_per_voucher();

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agent_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_accepted_payment_attempt_id_fkey" FOREIGN KEY ("accepted_payment_attempt_id") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation_item" ADD CONSTRAINT "inventory_reservation_item_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation_item" ADD CONSTRAINT "inventory_reservation_item_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

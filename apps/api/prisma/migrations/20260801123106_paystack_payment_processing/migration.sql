-- CreateEnum
CREATE TYPE "payment_event_processing_state" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'INVESTIGATION');

-- CreateEnum
CREATE TYPE "voucher_allocation_type" AS ENUM ('ORIGINAL', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('SALE_CREDIT', 'SALE_REVERSAL_DEBIT', 'PAYOUT_DEBIT', 'PAYOUT_FEE_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT');

-- CreateEnum
CREATE TYPE "delivery_channel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "delivery_message_state" AS ENUM ('PENDING', 'SUBMITTED', 'DELIVERED', 'FAILED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "payment_attempt" ADD COLUMN     "authorization_display_text" VARCHAR(500),
ADD COLUMN     "initialized_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_verified_at" TIMESTAMPTZ(6),
ADD COLUMN     "provider_status" VARCHAR(80);

-- CreateTable
CREATE TABLE "payment_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_attempt_id" UUID,
    "provider" VARCHAR(40) NOT NULL DEFAULT 'PAYSTACK',
    "provider_event_identity" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "provider_reference" VARCHAR(80),
    "provider_transaction_id" VARCHAR(120),
    "reported_amount_minor" BIGINT,
    "reported_currency" CHAR(3),
    "payload_fingerprint" BYTEA NOT NULL,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}',
    "processing_state" "payment_event_processing_state" NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_allocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_item_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "type" "voucher_allocation_type" NOT NULL DEFAULT 'ORIGINAL',
    "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallet_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_account_id" UUID NOT NULL,
    "order_id" UUID,
    "payment_attempt_id" UUID,
    "type" "ledger_entry_type" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" VARCHAR(160) NOT NULL,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "channel" "delivery_channel" NOT NULL,
    "state" "delivery_message_state" NOT NULL DEFAULT 'PENDING',
    "destination_ciphertext" BYTEA NOT NULL,
    "destination_mask" VARCHAR(160) NOT NULL,
    "contact_encryption_key_id" VARCHAR(100) NOT NULL,
    "contact_format_version" INTEGER NOT NULL DEFAULT 1,
    "stable_client_reference" VARCHAR(100) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_event_provider_event_identity_key" ON "payment_event"("provider_event_identity");

-- CreateIndex
CREATE INDEX "payment_event_payment_attempt_id_received_at_idx" ON "payment_event"("payment_attempt_id", "received_at");

-- CreateIndex
CREATE INDEX "payment_event_processing_state_received_at_idx" ON "payment_event"("processing_state", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_allocation_order_item_id_key" ON "voucher_allocation"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_allocation_voucher_id_key" ON "voucher_allocation"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_account_agent_id_key" ON "wallet_account"("agent_id");

-- CreateIndex
CREATE INDEX "ledger_entry_wallet_account_id_created_at_idx" ON "ledger_entry"("wallet_account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entry_order_id_idx" ON "ledger_entry"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_wallet_account_id_source_type_source_id_key" ON "ledger_entry"("wallet_account_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_message_stable_client_reference_key" ON "delivery_message"("stable_client_reference");

-- CreateIndex
CREATE INDEX "delivery_message_state_next_attempt_at_idx" ON "delivery_message"("state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "delivery_message_order_id_channel_idx" ON "delivery_message"("order_id", "channel");

-- AddForeignKey
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_allocation" ADD CONSTRAINT "voucher_allocation_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_allocation" ADD CONSTRAINT "voucher_allocation_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_account" ADD CONSTRAINT "wallet_account_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_wallet_account_id_fkey" FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_message" ADD CONSTRAINT "delivery_message_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_message" ADD CONSTRAINT "delivery_message_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

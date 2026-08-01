-- CreateEnum
CREATE TYPE "wallet_hold_state" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "withdrawal_state" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'AWAITING_MERCHANT_OTP', 'SUBMITTED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- AlterEnum
ALTER TYPE "otp_purpose" ADD VALUE 'AGENT_WITHDRAWAL';

-- CreateTable
CREATE TABLE "wallet_hold" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_account_id" UUID NOT NULL,
    "withdrawal_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "state" "wallet_hold_state" NOT NULL DEFAULT 'ACTIVE',
    "released_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "wallet_account_id" UUID NOT NULL,
    "destination_mask" VARCHAR(32) NOT NULL,
    "network" VARCHAR(32) NOT NULL,
    "net_amount_minor" BIGINT NOT NULL,
    "fee_amount_minor" BIGINT NOT NULL,
    "hold_amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "state" "withdrawal_state" NOT NULL DEFAULT 'REQUESTED',
    "approved_by_id" UUID,
    "decision_reason" VARCHAR(500),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_recipient" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "network" VARCHAR(32) NOT NULL,
    "phone_mask" VARCHAR(32) NOT NULL,
    "recipient_code" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "withdrawal_id" UUID NOT NULL,
    "provider_reference" VARCHAR(50) NOT NULL,
    "recipient_code" VARCHAR(100) NOT NULL,
    "transfer_code" VARCHAR(100),
    "provider_status" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_hold_withdrawal_id_key" ON "wallet_hold"("withdrawal_id");

-- CreateIndex
CREATE INDEX "wallet_hold_wallet_account_id_state_idx" ON "wallet_hold"("wallet_account_id", "state");

-- CreateIndex
CREATE INDEX "withdrawal_state_requested_at_idx" ON "withdrawal"("state", "requested_at");

-- CreateIndex
CREATE INDEX "withdrawal_agent_id_requested_at_idx" ON "withdrawal"("agent_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_recipient_recipient_code_key" ON "transfer_recipient"("recipient_code");

-- CreateIndex
CREATE INDEX "transfer_recipient_agent_id_network_active_idx" ON "transfer_recipient"("agent_id", "network", "active");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempt_provider_reference_key" ON "transfer_attempt"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempt_transfer_code_key" ON "transfer_attempt"("transfer_code");

-- CreateIndex
CREATE INDEX "transfer_attempt_withdrawal_id_created_at_idx" ON "transfer_attempt"("withdrawal_id", "created_at");

-- AddForeignKey
ALTER TABLE "wallet_hold" ADD CONSTRAINT "wallet_hold_wallet_account_id_fkey" FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_hold" ADD CONSTRAINT "wallet_hold_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_wallet_account_id_fkey" FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_recipient" ADD CONSTRAINT "transfer_recipient_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_attempt" ADD CONSTRAINT "transfer_attempt_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "transfer_recipient_agent_id_network_phone_fingerprint_key";

-- AlterTable
ALTER TABLE "transfer_recipient" ADD COLUMN     "account_name" VARCHAR(120),
ADD COLUMN     "phone_ciphertext" BYTEA;

-- CreateIndex
CREATE INDEX "transfer_recipient_agent_id_active_idx" ON "transfer_recipient"("agent_id", "active");

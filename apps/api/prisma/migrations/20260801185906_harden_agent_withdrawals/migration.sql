/*
  Warnings:

  - A unique constraint covering the columns `[withdrawal_id]` on the table `transfer_attempt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[agent_id,network,phone_fingerprint]` on the table `transfer_recipient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone_fingerprint` to the `transfer_recipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ledger_entry_type" ADD VALUE 'PAYOUT_COMPENSATION_CREDIT';

-- AlterTable
ALTER TABLE "transfer_recipient" ADD COLUMN     "phone_fingerprint" BYTEA NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempt_withdrawal_id_key" ON "transfer_attempt"("withdrawal_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_recipient_agent_id_network_phone_fingerprint_key" ON "transfer_recipient"("agent_id", "network", "phone_fingerprint");

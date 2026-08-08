-- CreateEnum
CREATE TYPE "withdrawal_payout_method" AS ENUM ('PAYSTACK', 'MANUAL');

-- AlterEnum
ALTER TYPE "withdrawal_state" ADD VALUE 'AWAITING_MANUAL_PAYMENT';

-- AlterTable
ALTER TABLE "withdrawal" ADD COLUMN     "manual_paid_at" TIMESTAMPTZ(6),
ADD COLUMN     "manual_paid_by_id" UUID,
ADD COLUMN     "manual_reference" VARCHAR(200),
ADD COLUMN     "payout_method" "withdrawal_payout_method" NOT NULL DEFAULT 'PAYSTACK';

-- AddForeignKey
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_manual_paid_by_id_fkey" FOREIGN KEY ("manual_paid_by_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_manual_reference_key" ON "withdrawal"("manual_reference");

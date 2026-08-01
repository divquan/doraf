-- CreateEnum
CREATE TYPE "refund_state" AS ENUM ('REQUESTED', 'SUBMITTED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_attempt_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "reason" VARCHAR(80) NOT NULL,
    "state" "refund_state" NOT NULL DEFAULT 'REQUESTED',
    "provider_reference" VARCHAR(160),
    "safe_metadata" JSONB NOT NULL DEFAULT '{}',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_payment_attempt_id_key" ON "refund"("payment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_provider_reference_key" ON "refund"("provider_reference");

-- CreateIndex
CREATE INDEX "refund_state_requested_at_idx" ON "refund"("state", "requested_at");

-- CreateIndex
CREATE INDEX "refund_order_id_created_at_idx" ON "refund"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

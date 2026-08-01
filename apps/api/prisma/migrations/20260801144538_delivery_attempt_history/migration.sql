-- CreateEnum
CREATE TYPE "delivery_attempt_state" AS ENUM ('PENDING', 'SUBMITTED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "delivery_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_message_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "stable_client_reference" VARCHAR(160) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "provider_message_reference" VARCHAR(160),
    "state" "delivery_attempt_state" NOT NULL DEFAULT 'PENDING',
    "safe_metadata" JSONB NOT NULL DEFAULT '{}',
    "failure_classification" VARCHAR(80),
    "submitted_at" TIMESTAMPTZ(6),
    "reconciled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempt_stable_client_reference_key" ON "delivery_attempt"("stable_client_reference");

-- CreateIndex
CREATE INDEX "delivery_attempt_delivery_message_id_created_at_idx" ON "delivery_attempt"("delivery_message_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_attempt_state_created_at_idx" ON "delivery_attempt"("state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempt_delivery_message_id_attempt_number_key" ON "delivery_attempt"("delivery_message_id", "attempt_number");

-- AddForeignKey
ALTER TABLE "delivery_attempt" ADD CONSTRAINT "delivery_attempt_delivery_message_id_fkey" FOREIGN KEY ("delivery_message_id") REFERENCES "delivery_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

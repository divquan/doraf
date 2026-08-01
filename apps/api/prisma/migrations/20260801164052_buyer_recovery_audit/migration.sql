-- CreateTable
CREATE TABLE "buyer_recovery_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "order_id" UUID,
    "event_type" VARCHAR(80) NOT NULL,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_recovery_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buyer_recovery_event_challenge_id_created_at_idx" ON "buyer_recovery_event"("challenge_id", "created_at");

-- CreateIndex
CREATE INDEX "buyer_recovery_event_order_id_created_at_idx" ON "buyer_recovery_event"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "buyer_recovery_event" ADD CONSTRAINT "buyer_recovery_event_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "buyer_recovery_challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

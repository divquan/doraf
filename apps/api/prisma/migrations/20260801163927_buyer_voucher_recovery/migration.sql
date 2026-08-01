-- CreateTable
CREATE TABLE "buyer_recovery_challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "verifier_fingerprint" BYTEA NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "recovery_token_fingerprint" BYTEA,
    "recovery_expires_at" TIMESTAMPTZ(6),
    "recovered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_recovery_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_recovery_challenge_recovery_token_fingerprint_key" ON "buyer_recovery_challenge"("recovery_token_fingerprint");

-- CreateIndex
CREATE INDEX "buyer_recovery_challenge_order_id_expires_at_idx" ON "buyer_recovery_challenge"("order_id", "expires_at");

-- CreateIndex
CREATE INDEX "buyer_recovery_challenge_expires_at_consumed_at_idx" ON "buyer_recovery_challenge"("expires_at", "consumed_at");

-- AddForeignKey
ALTER TABLE "buyer_recovery_challenge" ADD CONSTRAINT "buyer_recovery_challenge_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

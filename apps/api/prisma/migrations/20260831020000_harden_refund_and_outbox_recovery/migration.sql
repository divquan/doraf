ALTER TYPE "refund_state" ADD VALUE 'SUBMITTING' AFTER 'APPROVED';

ALTER TABLE "outbox_event"
ADD COLUMN "lease_until" TIMESTAMPTZ(6);

UPDATE "outbox_event"
SET "lease_until" = "claimed_at" + INTERVAL '2 minutes'
WHERE "state" IN ('CLAIMED', 'QUEUED')
  AND "lease_until" IS NULL
  AND "claimed_at" IS NOT NULL;

ALTER TABLE "outbox_event"
DROP CONSTRAINT "outbox_event_claim_state_valid";

ALTER TABLE "outbox_event"
ADD CONSTRAINT "outbox_event_claim_state_valid" CHECK (
    ("state" IN ('CLAIMED', 'QUEUED')) = (
        "claimed_at" IS NOT NULL AND
        "claim_token" IS NOT NULL AND
        "lease_until" IS NOT NULL
    )
);

ALTER TABLE "refund"
ADD COLUMN "submission_key" VARCHAR(160),
ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "next_reconciliation_at" TIMESTAMPTZ(6),
ADD COLUMN "last_error" VARCHAR(1000);

CREATE UNIQUE INDEX "refund_submission_key_key"
ON "refund"("submission_key");

CREATE INDEX "refund_state_next_reconciliation_at_idx"
ON "refund"("state", "next_reconciliation_at");

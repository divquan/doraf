ALTER TABLE "outbox_event"
DROP CONSTRAINT "outbox_event_claim_state_valid";

ALTER TABLE "outbox_event"
ADD CONSTRAINT "outbox_event_claim_state_valid" CHECK (
    ("state" IN ('CLAIMED', 'QUEUED')) = ("claimed_at" IS NOT NULL AND "claim_token" IS NOT NULL)
);

CREATE TYPE "otp_purpose" AS ENUM ('AGENT_REGISTRATION', 'AGENT_SIGN_IN');

CREATE TABLE "otp_challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purpose" "otp_purpose" NOT NULL,
    "agent_id" UUID,
    "phone_ciphertext" BYTEA NOT NULL,
    "phone_fingerprint" BYTEA NOT NULL,
    "phone_mask" VARCHAR(32) NOT NULL,
    "encryption_key_id" VARCHAR(100) NOT NULL,
    "format_version" INTEGER NOT NULL DEFAULT 1,
    "verifier_fingerprint" BYTEA NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "completion_token_fingerprint" BYTEA,
    "completion_expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "otp_challenge_phone_ciphertext_not_empty" CHECK (octet_length("phone_ciphertext") > 0),
    CONSTRAINT "otp_challenge_phone_fingerprint_not_empty" CHECK (octet_length("phone_fingerprint") > 0),
    CONSTRAINT "otp_challenge_verifier_not_empty" CHECK (octet_length("verifier_fingerprint") > 0),
    CONSTRAINT "otp_challenge_format_version_positive" CHECK ("format_version" > 0),
    CONSTRAINT "otp_challenge_attempts_valid" CHECK ("attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts"),
    CONSTRAINT "otp_challenge_completion_pair" CHECK (("completion_token_fingerprint" IS NULL) = ("completion_expires_at" IS NULL))
);

CREATE UNIQUE INDEX "otp_challenge_completion_token_fingerprint_key"
    ON "otp_challenge"("completion_token_fingerprint");
CREATE INDEX "otp_challenge_phone_fingerprint_purpose_expires_at_idx"
    ON "otp_challenge"("phone_fingerprint", "purpose", "expires_at");
CREATE INDEX "otp_challenge_agent_id_purpose_expires_at_idx"
    ON "otp_challenge"("agent_id", "purpose", "expires_at");

ALTER TABLE "otp_challenge"
    ADD CONSTRAINT "otp_challenge_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

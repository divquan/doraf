CREATE TYPE "internal_credential_type" AS ENUM ('PASSKEY');
CREATE TYPE "internal_auth_ceremony_type" AS ENUM (
    'PASSKEY_REGISTRATION',
    'PASSKEY_AUTHENTICATION'
);

CREATE TABLE "internal_credential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "internal_user_id" UUID NOT NULL,
    "type" "internal_credential_type" NOT NULL DEFAULT 'PASSKEY',
    "name" VARCHAR(80) NOT NULL,
    "credential_id" VARCHAR(1024) NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] NOT NULL,
    "device_type" VARCHAR(20) NOT NULL,
    "backed_up" BOOLEAN NOT NULL,
    "aaguid" VARCHAR(36) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "internal_credential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "internal_credential_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "internal_credential_id_not_blank" CHECK (length(btrim("credential_id")) > 0),
    CONSTRAINT "internal_credential_public_key_not_empty" CHECK (octet_length("public_key") > 0),
    CONSTRAINT "internal_credential_counter_nonnegative" CHECK ("counter" >= 0),
    CONSTRAINT "internal_credential_device_type_allowed" CHECK ("device_type" IN ('singleDevice', 'multiDevice')),
    CONSTRAINT "internal_credential_aaguid_format" CHECK (
        "aaguid" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

CREATE TABLE "internal_enrollment_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "internal_user_id" UUID NOT NULL,
    "created_by_internal_user_id" UUID,
    "token_fingerprint" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_enrollment_token_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "internal_enrollment_token_fingerprint_length" CHECK (octet_length("token_fingerprint") = 32),
    CONSTRAINT "internal_enrollment_token_valid_expiry" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "internal_auth_ceremony" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "internal_auth_ceremony_type" NOT NULL,
    "internal_user_id" UUID,
    "enrollment_token_id" UUID,
    "challenge" VARCHAR(160) NOT NULL,
    "credential_name" VARCHAR(80),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_auth_ceremony_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "internal_auth_ceremony_challenge_not_blank" CHECK (length(btrim("challenge")) > 0),
    CONSTRAINT "internal_auth_ceremony_attempt_count_range" CHECK ("attempt_count" BETWEEN 0 AND 5),
    CONSTRAINT "internal_auth_ceremony_valid_expiry" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "internal_auth_ceremony_registration_shape" CHECK (
        ("type" = 'PASSKEY_REGISTRATION' AND "internal_user_id" IS NOT NULL AND "enrollment_token_id" IS NOT NULL AND "credential_name" IS NOT NULL)
        OR
        ("type" = 'PASSKEY_AUTHENTICATION' AND "internal_user_id" IS NULL AND "enrollment_token_id" IS NULL AND "credential_name" IS NULL)
    )
);

CREATE UNIQUE INDEX "internal_credential_credential_id_key" ON "internal_credential"("credential_id");
CREATE INDEX "internal_credential_internal_user_id_revoked_at_idx" ON "internal_credential"("internal_user_id", "revoked_at");
CREATE UNIQUE INDEX "internal_enrollment_token_token_fingerprint_key" ON "internal_enrollment_token"("token_fingerprint");
CREATE UNIQUE INDEX "internal_enrollment_token_one_unconsumed_per_user"
    ON "internal_enrollment_token"("internal_user_id") WHERE "consumed_at" IS NULL;
CREATE INDEX "internal_enrollment_token_internal_user_id_expires_at_idx" ON "internal_enrollment_token"("internal_user_id", "expires_at");
CREATE UNIQUE INDEX "internal_auth_ceremony_challenge_key" ON "internal_auth_ceremony"("challenge");
CREATE INDEX "internal_auth_ceremony_type_expires_at_idx" ON "internal_auth_ceremony"("type", "expires_at");
CREATE INDEX "internal_auth_ceremony_internal_user_id_expires_at_idx" ON "internal_auth_ceremony"("internal_user_id", "expires_at");

ALTER TABLE "internal_credential" ADD CONSTRAINT "internal_credential_internal_user_id_fkey"
    FOREIGN KEY ("internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_enrollment_token" ADD CONSTRAINT "internal_enrollment_token_internal_user_id_fkey"
    FOREIGN KEY ("internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_enrollment_token" ADD CONSTRAINT "internal_enrollment_token_created_by_internal_user_id_fkey"
    FOREIGN KEY ("created_by_internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_auth_ceremony" ADD CONSTRAINT "internal_auth_ceremony_internal_user_id_fkey"
    FOREIGN KEY ("internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_auth_ceremony" ADD CONSTRAINT "internal_auth_ceremony_enrollment_token_id_fkey"
    FOREIGN KEY ("enrollment_token_id") REFERENCES "internal_enrollment_token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session" DROP CONSTRAINT "session_authentication_not_future";
ALTER TABLE "session" ADD CONSTRAINT "session_authentication_clock_skew"
    CHECK ("authenticated_at" <= "created_at" + INTERVAL '5 minutes');

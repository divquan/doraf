CREATE TYPE "internal_user_status" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "internal_role" AS ENUM ('SUPPORT', 'ADMINISTRATOR');

CREATE TABLE "internal_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" VARCHAR(120) NOT NULL,
    "role" "internal_role" NOT NULL,
    "status" "internal_user_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "internal_user_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "internal_user_display_name_not_blank" CHECK (length(btrim("display_name")) > 0),
    CONSTRAINT "internal_user_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID,
    "internal_user_id" UUID,
    "token_fingerprint" BYTEA NOT NULL,
    "authentication_strength" VARCHAR(40) NOT NULL,
    "authenticated_at" TIMESTAMPTZ(6) NOT NULL,
    "step_up_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_exactly_one_actor" CHECK (num_nonnulls("agent_id", "internal_user_id") = 1),
    CONSTRAINT "session_token_fingerprint_length" CHECK (octet_length("token_fingerprint") = 32),
    CONSTRAINT "session_authentication_strength_allowed" CHECK (
        "authentication_strength" IN ('PRIMARY', 'MFA', 'PHISHING_RESISTANT')
    ),
    CONSTRAINT "session_valid_expiry" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "session_authentication_not_future" CHECK ("authenticated_at" <= "created_at"),
    CONSTRAINT "session_step_up_after_authentication" CHECK (
        "step_up_at" IS NULL OR "step_up_at" >= "authenticated_at"
    )
);

CREATE TABLE "audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_internal_user_id" UUID NOT NULL,
    "actor_role" "internal_role" NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(160) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "authentication_strength" VARCHAR(40) NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_event_action_not_blank" CHECK (length(btrim("action")) > 0),
    CONSTRAINT "audit_event_entity_type_not_blank" CHECK (length(btrim("entity_type")) > 0),
    CONSTRAINT "audit_event_entity_id_not_blank" CHECK (length(btrim("entity_id")) > 0),
    CONSTRAINT "audit_event_reason_not_blank" CHECK (length(btrim("reason")) > 0),
    CONSTRAINT "audit_event_authentication_strength_allowed" CHECK (
        "authentication_strength" IN ('PRIMARY', 'MFA', 'PHISHING_RESISTANT')
    ),
    CONSTRAINT "audit_event_request_id_not_blank" CHECK (length(btrim("request_id")) > 0)
);

CREATE INDEX "internal_user_status_role_idx" ON "internal_user"("status", "role");
CREATE UNIQUE INDEX "session_token_fingerprint_key" ON "session"("token_fingerprint");
CREATE INDEX "session_internal_user_id_expires_at_idx" ON "session"("internal_user_id", "expires_at");
CREATE INDEX "session_agent_id_expires_at_idx" ON "session"("agent_id", "expires_at");
CREATE INDEX "audit_event_entity_type_entity_id_created_at_idx"
    ON "audit_event"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_event_actor_internal_user_id_created_at_idx"
    ON "audit_event"("actor_internal_user_id", "created_at");

ALTER TABLE "session"
    ADD CONSTRAINT "session_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session"
    ADD CONSTRAINT "session_internal_user_id_fkey"
    FOREIGN KEY ("internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_event"
    ADD CONSTRAINT "audit_event_actor_internal_user_id_fkey"
    FOREIGN KEY ("actor_internal_user_id") REFERENCES "internal_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit events are append-only'
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "audit_event_append_only"
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();

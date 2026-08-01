ALTER TABLE "buyer_recovery_event"
    ADD CONSTRAINT "buyer_recovery_event_type_not_blank"
    CHECK (length(btrim("event_type")) > 0);

CREATE FUNCTION "reject_buyer_recovery_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'buyer recovery events are append-only'
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "buyer_recovery_event_append_only"
BEFORE UPDATE OR DELETE ON "buyer_recovery_event"
FOR EACH ROW EXECUTE FUNCTION "reject_buyer_recovery_event_mutation"();

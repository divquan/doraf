CREATE FUNCTION validate_withdrawal_wallet_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "wallet_account"
    WHERE "id" = NEW."wallet_account_id"
      AND "agent_id" = NEW."agent_id"
      AND "currency" = NEW."currency"
  ) THEN
    RAISE EXCEPTION 'withdrawal wallet must belong to the agent and use the same currency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_withdrawal_wallet_owner_on_write
BEFORE INSERT OR UPDATE ON "withdrawal"
FOR EACH ROW
EXECUTE FUNCTION validate_withdrawal_wallet_owner();

CREATE FUNCTION validate_wallet_hold_withdrawal_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "withdrawal"
    WHERE "id" = NEW."withdrawal_id"
      AND "wallet_account_id" = NEW."wallet_account_id"
      AND "hold_amount_minor" = NEW."amount_minor"
      AND "currency" = NEW."currency"
  ) THEN
    RAISE EXCEPTION 'wallet hold must match its withdrawal financial snapshot';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_wallet_hold_withdrawal_snapshot_on_write
BEFORE INSERT OR UPDATE ON "wallet_hold"
FOR EACH ROW
EXECUTE FUNCTION validate_wallet_hold_withdrawal_snapshot();

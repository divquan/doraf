ALTER TABLE "withdrawal"
  ADD CONSTRAINT "withdrawal_net_amount_range"
    CHECK ("net_amount_minor" BETWEEN 1000 AND 5000000),
  ADD CONSTRAINT "withdrawal_fee_amount_allowed"
    CHECK ("fee_amount_minor" = 100),
  ADD CONSTRAINT "withdrawal_hold_amount_matches"
    CHECK ("hold_amount_minor" = "net_amount_minor" + "fee_amount_minor"),
  ADD CONSTRAINT "withdrawal_currency_allowed"
    CHECK ("currency" = 'GHS'),
  ADD CONSTRAINT "withdrawal_network_allowed"
    CHECK ("network" IN ('MTN', 'TELECEL', 'AIRTELTIGO'));

ALTER TABLE "wallet_hold"
  ADD CONSTRAINT "wallet_hold_amount_positive"
    CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "wallet_hold_currency_allowed"
    CHECK ("currency" = 'GHS'),
  ADD CONSTRAINT "wallet_hold_state_timestamps_valid"
    CHECK (
      ("state" = 'ACTIVE' AND "released_at" IS NULL AND "consumed_at" IS NULL)
      OR ("state" = 'RELEASED' AND "released_at" IS NOT NULL AND "consumed_at" IS NULL)
      OR ("state" = 'CONSUMED' AND "released_at" IS NULL AND "consumed_at" IS NOT NULL)
    );

CREATE FUNCTION protect_withdrawal_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.agent_id <> OLD.agent_id
    OR NEW.wallet_account_id <> OLD.wallet_account_id
    OR NEW.destination_mask <> OLD.destination_mask
    OR NEW.network <> OLD.network
    OR NEW.net_amount_minor <> OLD.net_amount_minor
    OR NEW.fee_amount_minor <> OLD.fee_amount_minor
    OR NEW.hold_amount_minor <> OLD.hold_amount_minor
    OR NEW.currency <> OLD.currency
  THEN
    RAISE EXCEPTION 'withdrawal financial snapshots cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_withdrawal_financial_snapshot_update
BEFORE UPDATE ON "withdrawal"
FOR EACH ROW
EXECUTE FUNCTION protect_withdrawal_financial_snapshot();

CREATE FUNCTION protect_wallet_hold_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.wallet_account_id <> OLD.wallet_account_id
    OR NEW.withdrawal_id <> OLD.withdrawal_id
    OR NEW.amount_minor <> OLD.amount_minor
    OR NEW.currency <> OLD.currency
  THEN
    RAISE EXCEPTION 'wallet hold financial snapshots cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_wallet_hold_snapshot_update
BEFORE UPDATE ON "wallet_hold"
FOR EACH ROW
EXECUTE FUNCTION protect_wallet_hold_snapshot();

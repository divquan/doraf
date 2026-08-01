-- Refine the existing append-only trigger without changing an applied migration.
CREATE OR REPLACE FUNCTION protect_ledger_entry_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry rows are append-only and cannot be updated or deleted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

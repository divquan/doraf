-- Create trigger to protect ledger_entry immutability (append-only)
CREATE OR REPLACE FUNCTION protect_ledger_entry_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry rows are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER prevent_ledger_entry_update_or_delete
BEFORE UPDATE OR DELETE ON ledger_entry
FOR EACH ROW
EXECUTE FUNCTION protect_ledger_entry_immutability();

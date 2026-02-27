-- Add vendor ICO field to contracts for storing subcontractor business ID extracted from contract
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS vendor_ico TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_vendor_ico ON contracts(vendor_ico);

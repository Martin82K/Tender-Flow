-- Add vendor rating fields to contracts
ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS vendor_rating NUMERIC(3,2) CHECK (vendor_rating >= 0 AND vendor_rating <= 5),
    ADD COLUMN IF NOT EXISTS vendor_rating_note TEXT,
    ADD COLUMN IF NOT EXISTS vendor_rating_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_rating_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_contracts_vendor_rating ON contracts(vendor_rating);

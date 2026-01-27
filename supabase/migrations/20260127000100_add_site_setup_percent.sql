-- Add site setup percent to contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS site_setup_percent NUMERIC(5,2);

-- Migration: Add price history column for tracking prices per selection round
-- Purpose: Store prices for each selection round (1, 2, 3) as JSON

-- Add price_history column (JSONB format: {"1": "1500000 Kč", "2": "1372066 Kč"})
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS price_history JSONB;

-- Comment explaining the structure
COMMENT ON COLUMN public.bids.price_history IS 'JSON object storing prices per selection round. Format: {"1": "2095766 Kč", "2": "1372066 Kč"}';

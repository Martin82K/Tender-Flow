-- Add contracted column to bids table
-- This tracks whether a contract has been signed with the winning bidder

ALTER TABLE bids ADD COLUMN IF NOT EXISTS contracted BOOLEAN DEFAULT FALSE;

-- Add index for performance when filtering by contracted status
CREATE INDEX IF NOT EXISTS idx_bids_contracted ON bids(contracted) WHERE contracted = TRUE;

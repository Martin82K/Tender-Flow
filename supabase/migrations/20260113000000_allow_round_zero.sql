-- ==========================================
-- Migration: Allow selection_round 0 for "Soutěž"
-- Date: 2026-01-13
-- ==========================================

-- Check constraint update for selection_round
-- We need to drop the existing one and recreate it to include 0
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_selection_round_check;

ALTER TABLE public.bids ADD CONSTRAINT bids_selection_round_check 
CHECK (selection_round IS NULL OR selection_round IN (0, 1, 2, 3));

-- Comment to explain what 0 means
COMMENT ON COLUMN public.bids.selection_round IS 'Kolo výběru: 0 = Soutěž, 1 = 1. kolo, 2 = 2. kolo, 3 = 3. kolo';

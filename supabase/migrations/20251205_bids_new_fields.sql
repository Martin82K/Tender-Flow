-- ==========================================
-- Migrace pro nová pole v bids tabulce
-- Datum: 2025-12-05
-- ==========================================

-- Přidání sloupce pro datum zaslání úpravy
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS update_date DATE;

-- Přidání sloupce pro kolo výběru (1, 2, nebo 3)
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS selection_round INTEGER;

-- Přidání constraintu pro validní hodnoty kola
-- (Nejprve odstraníme existující constraint pokud existuje)
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_selection_round_check;
ALTER TABLE public.bids ADD CONSTRAINT bids_selection_round_check 
CHECK (selection_round IS NULL OR selection_round IN (1, 2, 3));

-- ==========================================
-- Ověření struktury
-- ==========================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'bids'
ORDER BY ordinal_position;

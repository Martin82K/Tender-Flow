-- SQL příkazy pro aktualizaci tabulky demand_categories v Supabase
-- Přidávají chybějící sloupce pro termíny

-- 1. Přidání sloupce pro termín poptávky (deadline)
ALTER TABLE demand_categories 
ADD COLUMN IF NOT EXISTS deadline DATE;

-- 2. Přidání sloupce pro začátek termínu realizace
ALTER TABLE demand_categories 
ADD COLUMN IF NOT EXISTS realization_start DATE;

-- 3. Přidání sloupce pro konec termínu realizace
ALTER TABLE demand_categories 
ADD COLUMN IF NOT EXISTS realization_end DATE;

-- Volitelně: Přidání komentářů ke sloupcům
COMMENT ON COLUMN demand_categories.deadline IS 'Termín pro podání cenové nabídky';
COMMENT ON COLUMN demand_categories.realization_start IS 'Začátek předpokládaného termínu realizace';
COMMENT ON COLUMN demand_categories.realization_end IS 'Konec předpokládaného termínu realizace';

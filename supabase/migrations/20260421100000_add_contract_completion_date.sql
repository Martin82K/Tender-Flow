-- =====================================================
-- Přidání sloupce completion_date do tabulky contracts
-- Migration: 20260421100000_add_contract_completion_date.sql
--
-- Důvod: pro výpočet záruční doby je rozhodující datum
-- skutečného dokončení / předání díla, ne datum podpisu
-- smlouvy. WarrantySection používá tento sloupec jako
-- primární počátek záruky, s fallbackem na signed_at.
-- =====================================================

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS completion_date DATE;

COMMENT ON COLUMN contracts.completion_date IS
    'Datum skutečného dokončení / předání díla. Slouží jako počátek záruční doby.';

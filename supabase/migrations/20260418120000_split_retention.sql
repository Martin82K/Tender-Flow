-- =====================================================
-- Split retention: rozdělení pozastávky na krátkodobou a dlouhodobou
-- Migration: 20260418120000_split_retention.sql
-- =====================================================

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS retention_short_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS retention_short_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS retention_short_release_on DATE,
  ADD COLUMN IF NOT EXISTS retention_short_status TEXT
    CHECK (retention_short_status IN ('held','released')) DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS retention_long_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS retention_long_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS retention_long_release_on DATE,
  ADD COLUMN IF NOT EXISTS retention_long_status TEXT
    CHECK (retention_long_status IN ('held','released')) DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS site_setup_percent NUMERIC(5,2);

-- Migrace dat: existující retention_percent/amount přesypat do krátkodobé
UPDATE contracts
SET retention_short_percent = retention_percent,
    retention_short_amount  = retention_amount
WHERE (retention_percent IS NOT NULL OR retention_amount IS NOT NULL)
  AND retention_short_percent IS NULL
  AND retention_short_amount IS NULL;

-- Staré sloupce zatím NESMAZÁVAT — označit jako deprecated
COMMENT ON COLUMN contracts.retention_percent IS
  'DEPRECATED: nahrazeno retention_short_percent / retention_long_percent. Smazat v příští release.';
COMMENT ON COLUMN contracts.retention_amount IS
  'DEPRECATED: nahrazeno retention_short_amount / retention_long_amount. Smazat v příští release.';

COMMENT ON COLUMN contracts.retention_short_percent IS 'Krátkodobá pozastávka — uvolňuje se při/po převzetí díla.';
COMMENT ON COLUMN contracts.retention_long_percent IS 'Dlouhodobá pozastávka — drží se do konce záruční doby.';

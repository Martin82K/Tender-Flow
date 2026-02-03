-- Migration: Add Excel Indexer and Contracts module features
-- Purpose: Add excel_indexer and module_contracts features that can be controlled per subscription tier
-- Date: 2026-02-03

-- 1) Add the feature definitions
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('excel_indexer', 'Excel Indexer', 'Dvou-fázové zpracování Excel rozpočtů s indexováním', 'Moduly', 65),
  ('module_contracts', 'Modul Smlouvy', 'Správa smluv, dodatků a čerpání', 'Moduly', 15)
ON CONFLICT (key) DO NOTHING;

-- 2) Set tier permissions - Excel Indexer is NOT available on Free/Starter tier
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'excel_indexer', false),
  ('starter', 'excel_indexer', false),
  ('pro', 'excel_indexer', true),
  ('enterprise', 'excel_indexer', true),
  ('admin', 'excel_indexer', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 3) Set tier permissions - Contracts module is NOT available on Free tier
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'module_contracts', false),
  ('starter', 'module_contracts', true),
  ('pro', 'module_contracts', true),
  ('enterprise', 'module_contracts', true),
  ('admin', 'module_contracts', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

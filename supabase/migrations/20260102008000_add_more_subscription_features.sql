-- Migration: add_more_subscription_features
-- Date: 2026-01-02
-- Description: Adds more subscription features (Excel tools, schedule) with default tier flags.

-- 1) Add feature definitions
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('excel_unlocker', 'Excel Unlocker', 'Odemknutí chráněných XLSX souborů (nástroje v Nastavení)', 'Excel', 70),
  ('excel_merger', 'Excel Merger', 'Propojování/merge excelových souborů (ExcelMerger Pro)', 'Excel', 80),
  ('project_schedule', 'Harmonogram', 'Zobrazení harmonogramu projektu', 'Projekty', 90)
ON CONFLICT (key) DO NOTHING;

-- 2) Default tier flags
-- Free (disabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'excel_unlocker', false),
  ('free', 'excel_merger', false),
  ('free', 'project_schedule', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Pro (enabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('pro', 'excel_unlocker', true),
  ('pro', 'excel_merger', true),
  ('pro', 'project_schedule', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Enterprise (enabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('enterprise', 'excel_unlocker', true),
  ('enterprise', 'excel_merger', true),
  ('enterprise', 'project_schedule', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Admin always enabled (for new rows)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'admin' AS tier, f.key AS feature_key, true AS enabled
FROM public.subscription_features f
WHERE f.key IN ('excel_unlocker', 'excel_merger', 'project_schedule')
ON CONFLICT (tier, feature_key) DO NOTHING;


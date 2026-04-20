-- Add Command Center Feature Flags
-- Zapíná nový "Velitelský můstek" (/app/command-center) a jeho pokročilé moduly

-- 1) Feature definitions
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('module_command_center', 'Modul Velitelský můstek', 'Modulární přehledová obrazovka s KPI, pipeline funnel, timeline a akční frontou', 'Moduly', 6),
  ('cc_matrix_health', 'Velitelský můstek - Matice zdraví', 'Health scoring zakázek v modulu Velitelský můstek', 'Velitelský můstek', 70),
  ('cc_advanced_kpi', 'Velitelský můstek - Pokročilé KPI', 'Rozšířené KPI karty a derivované ukazatele ve Velitelském můstku', 'Velitelský můstek', 71)
ON CONFLICT (key) DO NOTHING;

-- 2) module_command_center: starter+ (základní můstek)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'module_command_center', false),
  ('starter', 'module_command_center', true),
  ('pro', 'module_command_center', true),
  ('enterprise', 'module_command_center', true),
  ('admin', 'module_command_center', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 3) Pokročilé moduly: pro+
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'cc_matrix_health', false),
  ('starter', 'cc_matrix_health', false),
  ('pro', 'cc_matrix_health', true),
  ('enterprise', 'cc_matrix_health', true),
  ('admin', 'cc_matrix_health', true),
  ('free', 'cc_advanced_kpi', false),
  ('starter', 'cc_advanced_kpi', false),
  ('pro', 'cc_advanced_kpi', true),
  ('enterprise', 'cc_advanced_kpi', true),
  ('admin', 'cc_advanced_kpi', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Migration: add_core_module_features
-- Date: 2026-01-04
-- Description: Adds core module features (dashboard, projects, contacts) that were missing
--              from subscription_features table, causing sidebar to hide these items.

-- 1) Add core module feature definitions
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('module_dashboard', 'Dashboard', 'Hlavní přehled aplikace', 'Moduly', 1),
  ('module_projects', 'Stavby', 'Správa projektů/staveb a jejich detailů', 'Moduly', 2),
  ('module_contacts', 'Subdodavatelé', 'Databáze kontaktů a subdodavatelů', 'Moduly', 3),
  ('module_pipeline', 'Pipeline', 'Kanban/Pipeline zobrazení', 'Moduly', 4),
  ('feature_ai_insights', 'AI Insights (pokročilé)', 'Pokročilá AI analýza projektů', 'AI', 55),
  ('feature_advanced_reporting', 'Pokročilé reporty', 'Generování pokročilých reportů', 'Reporty', 56),
  ('feature_team_collaboration', 'Týmová spolupráce', 'Sdílení a spolupráce v týmu', 'Spolupráce', 57),
  ('feature_api_access', 'API přístup', 'Přístup k REST/GraphQL API', 'Integrace', 58)
ON CONFLICT (key) DO NOTHING;

-- 2) Enable core modules for FREE tier (everyone should have access to basic modules)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'module_dashboard', true),
  ('free', 'module_projects', true),
  ('free', 'module_contacts', true),
  ('free', 'module_pipeline', false),
  ('free', 'feature_ai_insights', false),
  ('free', 'feature_advanced_reporting', false),
  ('free', 'feature_team_collaboration', false),
  ('free', 'feature_api_access', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 3) Enable core modules for PRO tier
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('pro', 'module_dashboard', true),
  ('pro', 'module_projects', true),
  ('pro', 'module_contacts', true),
  ('pro', 'module_pipeline', true),
  ('pro', 'feature_ai_insights', true),
  ('pro', 'feature_advanced_reporting', true),
  ('pro', 'feature_team_collaboration', true),
  ('pro', 'feature_api_access', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 4) Enable all for ENTERPRISE tier
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('enterprise', 'module_dashboard', true),
  ('enterprise', 'module_projects', true),
  ('enterprise', 'module_contacts', true),
  ('enterprise', 'module_pipeline', true),
  ('enterprise', 'feature_ai_insights', true),
  ('enterprise', 'feature_advanced_reporting', true),
  ('enterprise', 'feature_team_collaboration', true),
  ('enterprise', 'feature_api_access', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 5) Enable all for ADMIN tier (internal)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'admin' AS tier, f.key AS feature_key, true AS enabled
FROM public.subscription_features f
WHERE f.key IN (
  'module_dashboard', 'module_projects', 'module_contacts', 'module_pipeline',
  'feature_ai_insights', 'feature_advanced_reporting', 'feature_team_collaboration', 'feature_api_access'
)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 6) Enable all for DEMO tier (if exists)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'demo' AS tier, f.key AS feature_key, true AS enabled
FROM public.subscription_features f
WHERE f.key IN (
  'module_dashboard', 'module_projects', 'module_contacts'
)
ON CONFLICT (tier, feature_key) DO NOTHING;


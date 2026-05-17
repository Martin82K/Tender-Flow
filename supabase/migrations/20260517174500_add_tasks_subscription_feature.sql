-- =====================================================
-- Tasks — subscription feature registration
-- Migration: 20260517174500_add_tasks_subscription_feature.sql
--
-- The sidebar and route guard use module_tasks. Without this seed data the
-- TODO module is hidden even when the database schema exists.
-- =====================================================

INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES (
  'module_tasks',
  'TODO',
  'Osobní úkoly, podúkoly a propis do Command Center',
  'Moduly',
  6
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'module_tasks', false),
  ('starter', 'module_tasks', true),
  ('pro', 'module_tasks', true),
  ('enterprise', 'module_tasks', true),
  ('admin', 'module_tasks', true)
ON CONFLICT (tier, feature_key) DO UPDATE SET
  enabled = EXCLUDED.enabled;

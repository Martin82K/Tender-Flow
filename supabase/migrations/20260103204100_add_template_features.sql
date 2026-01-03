-- Migration: Add new subscription features
-- Purpose: Add dynamic templates, demand generation, and loser email features
-- Date: 2026-01-03

-- Add new features
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('dynamic_templates', 'Dynamické šablony', 'Šablony s dynamickými placeholdery pro emaily a dokumenty', 'Šablony', 70),
  ('demand_generation', 'Generování poptávky', 'Automatické generování poptávkových dokumentů', 'Poptávky', 80),
  ('loser_email', 'Email nevybraným', 'Hromadný email účastníkům, kteří nebyli vybráni', 'Komunikace', 90)
ON CONFLICT (key) DO NOTHING;

-- Demo tier (all disabled by default)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('demo', 'dynamic_templates', false),
  ('demo', 'demand_generation', false),
  ('demo', 'loser_email', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Free/Starter tier (all disabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'dynamic_templates', false),
  ('free', 'demand_generation', false),
  ('free', 'loser_email', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Pro tier (all enabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('pro', 'dynamic_templates', true),
  ('pro', 'demand_generation', true),
  ('pro', 'loser_email', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Enterprise tier (all enabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('enterprise', 'dynamic_templates', true),
  ('enterprise', 'demand_generation', true),
  ('enterprise', 'loser_email', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Admin tier (all enabled)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('admin', 'dynamic_templates', true),
  ('admin', 'demand_generation', true),
  ('admin', 'loser_email', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

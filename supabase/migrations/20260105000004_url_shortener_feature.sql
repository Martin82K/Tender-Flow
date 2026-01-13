-- Migration: Add URL Shortener feature
-- Add url_shortener feature to subscription_features table
-- Note: Enable for specific tiers via Admin UI or run tier mapping separately

INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('url_shortener', 'URL Zkracovač', 'Vytváření krátkých odkazů s vlastním aliasem a statistikami kliknutí', 'tools', 160)
ON CONFLICT (key) DO NOTHING;

-- Enable for tiers (uses correct tier names from check constraint: demo, free, pro, enterprise, admin)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT t.tier, 'url_shortener', true
FROM (VALUES ('demo'), ('free'), ('pro'), ('enterprise'), ('admin')) AS t(tier)
ON CONFLICT (tier, feature_key) DO UPDATE SET enabled = true;

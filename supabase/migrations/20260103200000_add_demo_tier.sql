-- Migration: Add demo tier to subscription system
-- Purpose: Add 'demo' tier before 'starter' (formerly 'free') tier
-- Date: 2026-01-03

-- 1) Update check constraint to allow 'demo' tier
ALTER TABLE public.subscription_tier_features
  DROP CONSTRAINT IF EXISTS subscription_tier_features_tier_check;

ALTER TABLE public.subscription_tier_features
  ADD CONSTRAINT subscription_tier_features_tier_check
  CHECK (tier IN ('demo', 'free', 'pro', 'enterprise', 'admin'));

-- 2) Seed demo tier features (default all disabled, admin will configure via UI)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'demo' AS tier, f.key AS feature_key, false AS enabled
FROM public.subscription_features f
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Migration: clear_legacy_stripe_overrides
-- Date: 2026-02-03
-- Description: Removes legacy Stripe tiers from admin override column after stripe_subscription_tier split

UPDATE public.user_profiles
SET subscription_tier_override = NULL
WHERE billing_subscription_id IS NOT NULL
  AND subscription_tier_override IS NOT NULL
  AND subscription_tier_override != 'admin';

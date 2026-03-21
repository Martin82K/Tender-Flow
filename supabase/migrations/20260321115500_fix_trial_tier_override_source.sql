-- Migration: fix_trial_tier_override_source
-- Date: 2026-03-21
-- Description: Keep trial tier state out of manual override fields and preserve paid overrides.

CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only seed trial state when no manual entitlement override exists.
  IF NEW.subscription_tier_override IS NULL THEN
    NEW.subscription_status := 'trial';
    NEW.subscription_tier_override := NULL;
    NEW.stripe_subscription_tier := 'pro';
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
    NEW.subscription_started_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.user_profiles
SET subscription_tier_override = NULL,
    stripe_subscription_tier = COALESCE(stripe_subscription_tier, 'pro'),
    trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days'),
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    updated_at = NOW()
WHERE subscription_tier_override = 'pro'
  AND subscription_status = 'trial';

-- Migration: Fix Trial Tier Assignment
-- Date: 2026-02-03
-- Purpose: Ensure new users explicitly get 'pro' tier during their trial period
--          without writing trial state into admin override fields.

CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start trial for new users (except admins)
  -- Keep admin override reserved for admin-set entitlements only.
  IF NEW.subscription_tier_override IS NULL OR NEW.subscription_tier_override != 'admin' THEN
    NEW.subscription_status := 'trial';
    NEW.subscription_tier_override := NULL;
    NEW.stripe_subscription_tier := 'pro'; -- Trial tier should live in Stripe tier field
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
    NEW.subscription_started_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

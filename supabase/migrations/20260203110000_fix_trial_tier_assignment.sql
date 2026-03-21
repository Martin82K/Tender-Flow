-- Migration: Fix Trial Tier Assignment
-- Date: 2026-02-03
-- Purpose: Ensure new users explicitly get 'pro' tier during their trial period.

CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start trial for new users (except admins)
  -- If no override is present, or it's not 'admin', set them to PRO trial
  IF NEW.subscription_tier_override IS NULL OR NEW.subscription_tier_override != 'admin' THEN
    NEW.subscription_status := 'trial';
    NEW.subscription_tier_override := 'pro'; -- Explicitly set to PRO
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
    NEW.subscription_started_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

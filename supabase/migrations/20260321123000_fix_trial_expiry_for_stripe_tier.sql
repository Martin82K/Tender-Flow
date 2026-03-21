-- Migration: fix_trial_expiry_for_stripe_tier
-- Date: 2026-03-21
-- Description: Ensure stripe-backed trial tiers expire when trial_ends_at has passed.

CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_override TEXT;
  v_stripe_tier TEXT;
  v_org_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_effective_tier TEXT;
BEGIN
  -- 1. Get user's subscription info
  SELECT
    subscription_tier_override,
    stripe_subscription_tier,
    subscription_expires_at,
    subscription_status,
    trial_ends_at
  INTO v_admin_override, v_stripe_tier, v_expires_at, v_status, v_trial_ends_at
  FROM public.user_profiles
  WHERE user_id = target_user_id;

  -- 2. Get Organization tier (fallback)
  SELECT o.subscription_tier
  INTO v_org_tier
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = target_user_id
  ORDER BY om.created_at ASC
  LIMIT 1;

  -- 3. Admin override always wins (if set and not expired)
  IF v_admin_override IS NOT NULL THEN
    -- Admin tier never expires
    IF v_admin_override = 'admin' THEN
      RETURN 'admin';
    END IF;

    -- For other admin overrides, check expiration
    IF v_status = 'expired' THEN
      v_admin_override := NULL;
    ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE user_id = target_user_id AND subscription_status = 'trial';
      v_admin_override := NULL;
    ELSIF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE user_id = target_user_id AND subscription_status IN ('active', 'cancelled');
      v_admin_override := NULL;
    END IF;
  END IF;

  -- 4. Stripe tier (check expiration too)
  IF v_admin_override IS NULL AND v_stripe_tier IS NOT NULL THEN
    IF v_status = 'expired' THEN
      v_stripe_tier := NULL;
    ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE user_id = target_user_id AND subscription_status = 'trial';
      v_stripe_tier := NULL;
    ELSIF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      v_stripe_tier := NULL;
    END IF;
  END IF;

  -- 5. Determine Effective Tier (priority: admin > stripe > org > free)
  v_effective_tier := COALESCE(v_admin_override, v_stripe_tier, v_org_tier, 'free');

  RETURN v_effective_tier;
END;
$$;

UPDATE public.user_profiles
SET subscription_status = 'expired',
    stripe_subscription_tier = NULL,
    updated_at = NOW()
WHERE subscription_status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < NOW()
  AND subscription_tier_override IS NULL;

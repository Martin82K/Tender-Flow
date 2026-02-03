-- Migration: add_stripe_subscription_tier
-- Date: 2026-02-03
-- Description: Adds stripe_subscription_tier column to separate Stripe-sourced tier from admin override

-- 1. Add the new column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_tier TEXT DEFAULT NULL;

-- 2. Copy existing Stripe-sourced data (if subscription_tier_override was set by Stripe)
-- We'll migrate existing data where there's a billing_subscription_id
UPDATE public.user_profiles
SET stripe_subscription_tier = subscription_tier_override
WHERE billing_subscription_id IS NOT NULL 
  AND subscription_tier_override IS NOT NULL
  AND subscription_tier_override != 'admin';

-- 3. Update get_user_subscription_tier to include stripe_subscription_tier in fallback chain
DROP FUNCTION IF EXISTS public.get_user_subscription_tier(UUID);

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
    ELSIF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      v_stripe_tier := NULL;
    END IF;
  END IF;

  -- 5. Determine Effective Tier (priority: admin > stripe > org > free)
  v_effective_tier := COALESCE(v_admin_override, v_stripe_tier, v_org_tier, 'free');
  
  RETURN v_effective_tier;
END;
$$;

-- 4. Update get_user_subscription_status to return stripe_subscription_tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jsonb_build_object(
    'tier', COALESCE(subscription_tier_override, stripe_subscription_tier, 'free'),
    'effectiveTier', public.get_user_subscription_tier(v_user_id),
    'status', COALESCE(subscription_status, 'active'),
    'expiresAt', subscription_expires_at,
    'startedAt', subscription_started_at,
    'trialEndsAt', trial_ends_at,
    'cancelAtPeriodEnd', COALESCE(subscription_cancel_at_period_end, false),
    'billingCustomerId', billing_customer_id,
    'billingProvider', billing_provider,
    'stripeSubscriptionTier', stripe_subscription_tier,
    'adminOverride', subscription_tier_override,
    'daysRemaining', 
      CASE 
        WHEN subscription_expires_at IS NOT NULL THEN
          GREATEST(0, EXTRACT(DAY FROM subscription_expires_at - NOW())::INTEGER)
        WHEN trial_ends_at IS NOT NULL AND subscription_status = 'trial' THEN
          GREATEST(0, EXTRACT(DAY FROM trial_ends_at - NOW())::INTEGER)
        ELSE NULL
      END
  )
  INTO v_result
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('tier', 'free', 'status', 'active'));
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;

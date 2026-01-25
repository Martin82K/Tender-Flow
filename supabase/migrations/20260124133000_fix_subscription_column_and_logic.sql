-- Migration: Fix subscription column name and logic
-- Description: 
-- 1. Updates get_user_subscription_tier to use 'subscription_tier_override' instead of trying to access non-existent 'subscription_tier'.
-- 2. Restores Organization tier fallback logic while maintaining the new expiration checks for individual subscriptions.
-- 3. Updates get_user_subscription_status to map 'tier' to 'subscription_tier_override'.

-- 1. get_user_subscription_tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
-- VOLATILE (default) because it updates rows
AS $$
DECLARE
  v_user_tier TEXT;
  v_org_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_final_tier TEXT;
BEGIN
  -- 1. Get user's individual subscription info
  SELECT 
    subscription_tier_override, -- Corrected column name
    subscription_expires_at,
    subscription_status,
    trial_ends_at
  INTO v_user_tier, v_expires_at, v_status, v_trial_ends_at
  FROM public.user_profiles
  WHERE id = target_user_id;

  -- 2. Get Organization tier (fallback)
  SELECT o.subscription_tier
  INTO v_org_tier
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = target_user_id
  ORDER BY om.created_at ASC
  LIMIT 1;

  -- 3. Validate Individual Subscription
  IF v_user_tier IS NOT NULL THEN
    
    -- Admin always valid
    IF v_user_tier = 'admin' THEN
      RETURN 'admin';
    END IF;

    -- Check status explicitly expired
    IF v_status = 'expired' THEN
      v_user_tier := NULL; -- Invalid
    
    -- Check Trial Expiration
    ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE id = target_user_id AND subscription_status = 'trial';
      v_user_tier := NULL;

    -- Check Subscription Expiration
    ELSIF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE id = target_user_id AND subscription_status IN ('active', 'cancelled');
      v_user_tier := NULL;
    END IF;
  END IF;

  -- 4. Determine Effective Tier
  -- Priority: Valid Individual Tier > Org Tier > Free
  v_final_tier := COALESCE(v_user_tier, v_org_tier, 'free');
  
  RETURN v_final_tier;
END;
$$;

-- 2. get_user_subscription_status
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
    'tier', COALESCE(subscription_tier_override, 'free'), -- Corrected column name
    'effectiveTier', public.get_user_subscription_tier(v_user_id),
    'status', COALESCE(subscription_status, 'active'),
    'expiresAt', subscription_expires_at,
    'startedAt', subscription_started_at,
    'trialEndsAt', trial_ends_at,
    'cancelAtPeriodEnd', COALESCE(subscription_cancel_at_period_end, false),
    'billingCustomerId', billing_customer_id,
    'billingProvider', billing_provider,
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
  WHERE id = v_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('tier', 'free', 'status', 'active'));
END;
$$;

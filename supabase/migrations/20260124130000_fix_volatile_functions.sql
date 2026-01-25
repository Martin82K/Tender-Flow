-- Migration: Fix Volatile Functions
-- Description: Removes STABLE keyword from functions that now have side-effects (subscription expiration updates).
--              Previously, get_user_subscription_tier was marked STABLE but performed UPDATEs, causing runtime errors.

-- 1. get_user_subscription_tier (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
-- REMOVED STABLE per fix
AS $$
DECLARE
  v_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Get user's subscription info
  SELECT 
    COALESCE(subscription_tier, 'free'),
    subscription_expires_at,
    subscription_status,
    trial_ends_at
  INTO v_tier, v_expires_at, v_status, v_trial_ends_at
  FROM public.user_profiles
  WHERE id = target_user_id;

  -- If no user found, return free
  IF v_tier IS NULL THEN
    RETURN 'free';
  END IF;

  -- Admin tier never expires
  IF v_tier = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Check if subscription is expired
  IF v_status = 'expired' THEN
    RETURN 'free';
  END IF;

  -- Check if trial has ended
  IF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status = 'trial';
    RETURN 'free';
  END IF;

  -- Check if paid subscription has expired
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status IN ('active', 'cancelled');
    RETURN 'free';
  END IF;

  RETURN v_tier;
END;
$$;

-- 2. get_user_subscription_status (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- REMOVED STABLE
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
    'tier', COALESCE(subscription_tier, 'free'),
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

-- 3. user_has_feature (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.user_has_feature(feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- REMOVED STABLE
AS $$
DECLARE
  user_tier TEXT;
  feature_enabled BOOLEAN;
BEGIN
  user_tier := public.get_user_subscription_tier(auth.uid());
  
  IF user_tier = 'admin' THEN
    RETURN true;
  END IF;

  SELECT stf.enabled INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = feature_key;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

-- 4. user_id_has_feature (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.user_id_has_feature(target_user_id UUID, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- REMOVED STABLE
AS $$
DECLARE
  user_tier TEXT;
  feature_enabled BOOLEAN;
BEGIN
  user_tier := public.get_user_subscription_tier(target_user_id);
  
  IF user_tier = 'admin' THEN
    RETURN true;
  END IF;

  SELECT stf.enabled INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = feature_key;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

-- 5. get_user_enabled_features (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.get_user_enabled_features()
RETURNS TABLE (
  feature_key TEXT,
  feature_name TEXT,
  feature_description TEXT,
  feature_category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- REMOVED STABLE
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  user_tier := public.get_user_subscription_tier(auth.uid());

  IF user_tier = 'admin' THEN
    RETURN QUERY
    SELECT sf.key, sf.name, sf.description, sf.category
    FROM public.subscription_features sf
    ORDER BY sf.sort_order, sf.key;
  END IF;

  RETURN QUERY
  SELECT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  JOIN public.subscription_tier_features stf ON stf.feature_key = sf.key
  WHERE stf.tier = user_tier AND stf.enabled = true
  ORDER BY sf.sort_order, sf.key;
END;
$$;

-- 6. check_feature_access (Modified to be VOLATILE)
CREATE OR REPLACE FUNCTION public.check_feature_access(feature_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- REMOVED STABLE
AS $$
DECLARE
  user_tier TEXT;
  has_access BOOLEAN;
BEGIN
  user_tier := public.get_user_subscription_tier(auth.uid());
  has_access := public.user_has_feature(feature_key);
  
  RETURN jsonb_build_object(
    'feature', feature_key,
    'tier', user_tier,
    'hasAccess', has_access
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.user_id_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_id_has_feature(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_enabled_features() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_enabled_features() TO service_role;

GRANT EXECUTE ON FUNCTION public.check_feature_access(TEXT) TO authenticated;

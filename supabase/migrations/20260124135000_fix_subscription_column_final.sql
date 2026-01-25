-- Migration: Fix subscription functions - FINAL
-- Fixes: column "id" does not exist (user_profiles PK is user_id, not id)
-- Fixes: column "subscription_tier" does not exist (correct is subscription_tier_override)

-- 1. get_user_subscription_tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- FIXED: user_profiles uses 'user_id' as PK, not 'id'
  SELECT 
    subscription_tier_override,
    subscription_expires_at,
    subscription_status,
    trial_ends_at
  INTO v_user_tier, v_expires_at, v_status, v_trial_ends_at
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

  -- 3. Validate Individual Subscription
  IF v_user_tier IS NOT NULL THEN
    
    -- Admin always valid
    IF v_user_tier = 'admin' THEN
      RETURN 'admin';
    END IF;

    -- Check status explicitly expired
    IF v_status = 'expired' THEN
      v_user_tier := NULL;
    
    -- Check Trial Expiration
    ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE user_id = target_user_id AND subscription_status = 'trial';
      v_user_tier := NULL;

    -- Check Subscription Expiration
    ELSIF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      UPDATE public.user_profiles
      SET subscription_status = 'expired'
      WHERE user_id = target_user_id AND subscription_status IN ('active', 'cancelled');
      v_user_tier := NULL;
    END IF;
  END IF;

  -- 4. Determine Effective Tier
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

  -- FIXED: user_profiles uses 'user_id' as PK, not 'id'
  SELECT jsonb_build_object(
    'tier', COALESCE(subscription_tier_override, 'free'),
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
  WHERE user_id = v_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('tier', 'free', 'status', 'active'));
END;
$$;

-- 3. user_has_feature
CREATE OR REPLACE FUNCTION public.user_has_feature(feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. user_id_has_feature
CREATE OR REPLACE FUNCTION public.user_id_has_feature(target_user_id UUID, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 5. get_user_enabled_features
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

-- 6. check_feature_access
CREATE OR REPLACE FUNCTION public.check_feature_access(feature_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant permissions
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

-- Migration: fix_feature_access_functions
-- Date: 2026-02-05
-- Description: Fix ambiguous parameter references in feature access helpers.

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

  SELECT stf.enabled
  INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = $1;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

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

  SELECT stf.enabled
  INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = $2;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

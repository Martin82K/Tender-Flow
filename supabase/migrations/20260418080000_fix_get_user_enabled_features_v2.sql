-- Fix: get_user_enabled_features_v2 failed with 42P10
-- "for SELECT DISTINCT, ORDER BY expressions must appear in select list"
-- Original used DISTINCT + ORDER BY sf.sort_order (not in projection).
-- Rewrite via EXISTS — no DISTINCT needed since sf.key is unique.

CREATE OR REPLACE FUNCTION public.get_user_enabled_features_v2()
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
  v_tier_info JSONB;
  v_tier TEXT;
BEGIN
  v_tier_info := public.get_effective_user_tier(auth.uid());
  v_tier := v_tier_info->>'tier';

  IF v_tier = 'admin' THEN
    RETURN QUERY
    SELECT sf.key, sf.name, sf.description, sf.category
    FROM public.subscription_features sf
    ORDER BY sf.sort_order, sf.key;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  WHERE EXISTS (
    SELECT 1
    FROM public.subscription_tier_features stf
    WHERE stf.feature_key = sf.key
      AND stf.tier = v_tier
      AND stf.enabled = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_feature_overrides ufo
    WHERE ufo.feature_key = sf.key
      AND ufo.user_id = auth.uid()
      AND (ufo.expires_at IS NULL OR ufo.expires_at > now())
  )
  ORDER BY sf.sort_order, sf.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_enabled_features_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_enabled_features_v2() TO service_role;

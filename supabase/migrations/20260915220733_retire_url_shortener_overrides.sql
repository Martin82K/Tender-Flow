BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DELETE FROM public.user_feature_overrides WHERE feature_key = 'url_shortener';
-- Archived catalog rows must never re-enable the retired tool, including for admins.
UPDATE public.subscription_features SET name = 'Archivovaná funkce',
  description = 'Zkracovač byl vyřazen; záznam slouží pouze k uchování historie.',
  category = 'Archiv', updated_at = now()
WHERE key = 'url_shortener';

CREATE OR REPLACE FUNCTION public.user_has_feature(feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(auth.uid());
BEGIN
  IF feature_key = 'url_shortener' THEN RETURN false; END IF;
  IF v_tier = 'admin' THEN RETURN true; END IF;
  IF v_tier NOT IN ('starter', 'pro', 'enterprise') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.subscription_tier_features stf WHERE stf.tier = v_tier AND stf.feature_key = $1 AND stf.enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_id_has_feature(target_user_id uuid, feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(target_user_id);
BEGIN
  IF feature_key = 'url_shortener' THEN RETURN false; END IF;
  IF v_tier = 'admin' THEN RETURN true; END IF;
  IF v_tier NOT IN ('starter', 'pro', 'enterprise') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.subscription_tier_features stf WHERE stf.tier = v_tier AND stf.feature_key = $2 AND stf.enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_enabled_features_v2()
RETURNS TABLE(feature_key text, feature_name text, feature_description text, feature_category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(auth.uid());
BEGIN
  IF v_tier NOT IN ('starter', 'pro', 'enterprise', 'admin') THEN RETURN; END IF;
  RETURN QUERY SELECT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  WHERE sf.key <> 'url_shortener' AND (v_tier = 'admin' OR EXISTS (
    SELECT 1 FROM public.subscription_tier_features stf WHERE stf.feature_key = sf.key AND stf.tier = v_tier AND stf.enabled
  ) OR EXISTS (
    SELECT 1 FROM public.user_feature_overrides ufo WHERE ufo.feature_key = sf.key AND ufo.user_id = auth.uid()
      AND (ufo.expires_at IS NULL OR ufo.expires_at > now())
  )) ORDER BY sf.sort_order, sf.key;
END;
$$;

COMMIT;

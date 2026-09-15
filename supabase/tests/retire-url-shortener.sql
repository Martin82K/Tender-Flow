-- Run on an administrative connection after the retirement migration.
BEGIN;
DO $$
DECLARE role_name text; retired_function regprocedure;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscription_tier_features WHERE feature_key = 'url_shortener') THEN
    RAISE EXCEPTION 'Retired URL shortener still has tier entitlements';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_features f WHERE f.key = 'url_shortener'
    AND NOT EXISTS (SELECT 1 FROM public.feature_usage_events e WHERE e.feature_key = f.key)) THEN
    RAISE EXCEPTION 'Unreferenced retired catalog entry remains';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.short_urls'::regclass) THEN
    RAISE EXCEPTION 'Historical short URLs must retain RLS';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(role_name, 'public.short_urls', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Retired table remains accessible to %', role_name;
    END IF;
    FOR retired_function IN
      SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('get_short_url_target','increment_short_url_clicks')
    LOOP
      IF has_function_privilege(role_name, retired_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Retired RPC % remains executable by %', retired_function, role_name;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_table_privilege('service_role', 'public.short_urls', 'SELECT') THEN
    RAISE EXCEPTION 'Historical data must remain available for trusted administration';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'passed; URL shortener retired, historical storage retained' AS result;

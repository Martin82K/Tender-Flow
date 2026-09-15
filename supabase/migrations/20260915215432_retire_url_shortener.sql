BEGIN;
-- Retire the feature without deleting historical links or usage events.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM public.subscription_tier_features WHERE feature_key = 'url_shortener';
-- Preserve catalog metadata when referenced by historical usage events.
DELETE FROM public.subscription_features f
WHERE f.key = 'url_shortener'
  AND NOT EXISTS (SELECT 1 FROM public.feature_usage_events e WHERE e.feature_key = f.key);

-- Old permissive RLS policies must not keep the retired API usable.
REVOKE ALL PRIVILEGES ON TABLE public.short_urls FROM PUBLIC, anon, authenticated;
DO $$
DECLARE retired_function regprocedure;
BEGIN
  FOR retired_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_short_url_target', 'increment_short_url_clicks')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated', retired_function);
  END LOOP;
END;
$$;
COMMIT;

-- Harden short URL read access:
-- - remove public SELECT policy that exposed whole short_urls table
-- - keep owner-scoped SELECT for user's own link management
-- - provide SECURITY DEFINER resolver for public redirect by code only

ALTER TABLE public.short_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read short URLs" ON public.short_urls;
DROP POLICY IF EXISTS "Users can read own short URLs" ON public.short_urls;

CREATE POLICY "Users can read own short URLs"
  ON public.short_urls
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.get_short_url_target(url_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text;
BEGIN
  IF url_id IS NULL
     OR length(url_id) < 3
     OR length(url_id) > 128
     OR url_id !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT original_url
    INTO v_target
  FROM public.short_urls
  WHERE id = url_id
  LIMIT 1;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.get_short_url_target(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_short_url_target(text) TO anon, authenticated, service_role;

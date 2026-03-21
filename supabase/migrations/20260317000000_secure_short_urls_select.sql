-- Migration: secure short URL reads and preserve public redirect resolution

-- Replace overly broad public SELECT policy
DROP POLICY IF EXISTS "Everyone can read short URLs" ON public.short_urls;
DROP POLICY IF EXISTS "Users can read their own short URLs" ON public.short_urls;

CREATE POLICY "Users can read their own short URLs" ON public.short_urls
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Public resolver used for redirects without exposing table-wide reads
CREATE OR REPLACE FUNCTION public.resolve_short_url(url_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_url text;
BEGIN
  UPDATE public.short_urls
  SET clicks = clicks + 1
  WHERE id = url_id
  RETURNING original_url INTO resolved_url;

  RETURN resolved_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_short_url(text) TO anon, authenticated, service_role;

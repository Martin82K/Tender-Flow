-- Keep MCP bid writes visible in an already-open Tender Flow UI.
-- Postgres Changes still applies the table's RLS policies to each subscriber.

DO $$
DECLARE
  bids_rls_enabled BOOLEAN;
BEGIN
  SELECT relation.relrowsecurity
  INTO bids_rls_enabled
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'bids'
    AND relation.relkind = 'r';

  IF bids_rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Refusing Realtime publication: public.bids is missing or RLS is disabled.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION
      'Refusing Realtime publication: supabase_realtime publication is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "block_oauth_client_direct_access"
  ON public.bids;
CREATE POLICY "block_oauth_client_direct_access"
  ON public.bids AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
      NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
    ) IS NULL
  )
  WITH CHECK (
    COALESCE(
      NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
      NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
    ) IS NULL
  );

-- Supabase OAuth access tokens carry client_id but do not automatically carry
-- the RFC 8707 MCP resource indicator. Keep aud="authenticated" unchanged for
-- the Data API and add a trusted, server-issued resource claim under
-- app_metadata. Regular Tender Flow session tokens have no client_id and are
-- returned unchanged.

CREATE OR REPLACE FUNCTION public.tender_flow_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims JSONB := COALESCE(event -> 'claims', '{}'::JSONB);
  oauth_client_id TEXT := NULLIF(BTRIM(event -> 'claims' ->> 'client_id'), '');
BEGIN
  IF oauth_client_id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('claims', claims);
  END IF;

  IF JSONB_TYPEOF(claims -> 'app_metadata') IS DISTINCT FROM 'object' THEN
    claims := JSONB_SET(claims, '{app_metadata}', '{}'::JSONB, true);
  END IF;

  claims := JSONB_SET(
    claims,
    '{app_metadata,mcp_resource}',
    '"https://www.tenderflow.cz/api/mcp"'::JSONB,
    true
  );

  RETURN JSONB_BUILD_OBJECT('claims', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.tender_flow_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB) TO supabase_auth_admin;

COMMENT ON FUNCTION public.tender_flow_access_token_hook(JSONB) IS
  'Auth hook: adds the canonical Tender Flow MCP resource to OAuth access tokens while leaving regular sessions unchanged.';

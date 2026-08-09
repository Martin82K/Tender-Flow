-- Supabase passes the OAuth client identifier as a top-level Custom Access
-- Token Hook field. Reading it from claims leaves OAuth access tokens on the
-- general authenticated role and prevents the MCP server from accepting them.

CREATE OR REPLACE FUNCTION public.tender_flow_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims JSONB := COALESCE(event -> 'claims', '{}'::JSONB);
  oauth_client_id TEXT := NULLIF(BTRIM(event ->> 'client_id'), '');
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
  mcp_client_is_registered BOOLEAN := false;
BEGIN
  IF oauth_client_id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('claims', claims);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mcp_oauth_client_resources AS resource_grant
    JOIN auth.oauth_clients AS oauth_client
      ON oauth_client.id = resource_grant.client_id
    WHERE resource_grant.client_id::TEXT = oauth_client_id
      AND resource_grant.resource = canonical_resource
      AND resource_grant.enabled = true
      AND oauth_client.deleted_at IS NULL
  )
  INTO mcp_client_is_registered;

  IF NOT mcp_client_is_registered THEN
    RETURN JSONB_BUILD_OBJECT('claims', claims);
  END IF;

  IF JSONB_TYPEOF(claims -> 'app_metadata') IS DISTINCT FROM 'object' THEN
    claims := JSONB_SET(claims, '{app_metadata}', '{}'::JSONB, true);
  END IF;

  claims := JSONB_SET(
    claims,
    '{app_metadata,mcp_resource}',
    TO_JSONB(canonical_resource),
    true
  );
  claims := JSONB_SET(
    claims,
    '{role}',
    TO_JSONB('tenderflow_mcp_client'::TEXT),
    true
  );

  RETURN JSONB_BUILD_OBJECT('claims', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.tender_flow_access_token_hook(JSONB)
  FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB) TO supabase_auth_admin;

COMMENT ON FUNCTION public.tender_flow_access_token_hook(JSONB) IS
  'Assigns the isolated MCP role and canonical resource to registered OAuth clients using the top-level hook client_id.';

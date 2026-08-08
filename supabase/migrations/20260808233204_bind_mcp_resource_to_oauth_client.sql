-- Bind the synthetic MCP resource claim to an explicit, server-managed OAuth
-- client registry. Supabase's custom access token hook is invoked for every
-- token issuance and does not expose an RFC 8707 resource request, so the
-- canonical resource must never be inferred from client_id presence alone.

CREATE TABLE public.mcp_oauth_client_resources (
  client_id UUID NOT NULL REFERENCES auth.oauth_clients(id) ON DELETE CASCADE,
  resource TEXT NOT NULL CHECK (
    resource = 'https://www.tenderflow.cz/api/mcp'
  ),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, resource)
);

ALTER TABLE public.mcp_oauth_client_resources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_oauth_client_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.mcp_oauth_client_resources TO supabase_auth_admin;
REVOKE ALL ON TABLE public.mcp_oauth_client_resources FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mcp_oauth_client_resources TO service_role;

CREATE POLICY "Auth reads enabled MCP OAuth client resources"
  ON public.mcp_oauth_client_resources
  FOR SELECT
  TO supabase_auth_admin
  USING (enabled = true);

INSERT INTO public.mcp_oauth_client_resources (client_id, resource)
SELECT c.id, 'https://www.tenderflow.cz/api/mcp'
FROM auth.oauth_clients AS c
WHERE c.id IN (
  'c6d04896-33d1-4cca-a7f2-8d380ed26f0d',
  '9a9b2e02-5e83-4c1f-8a6f-15c7a88d9066'
)
  AND c.deleted_at IS NULL
ON CONFLICT (client_id, resource) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tender_flow_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims JSONB := COALESCE(event -> 'claims', '{}'::JSONB);
  oauth_client_id TEXT := NULLIF(BTRIM(event -> 'claims' ->> 'client_id'), '');
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
  mcp_client_is_registered BOOLEAN := false;
BEGIN
  IF oauth_client_id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('claims', claims);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mcp_oauth_client_resources AS resource_grant
    JOIN auth.oauth_clients AS c ON c.id = resource_grant.client_id
    WHERE resource_grant.client_id::TEXT = oauth_client_id
      AND resource_grant.resource = canonical_resource
      AND resource_grant.enabled = true
      AND c.deleted_at IS NULL
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

  RETURN JSONB_BUILD_OBJECT('claims', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.tender_flow_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB) TO supabase_auth_admin;

COMMENT ON TABLE public.mcp_oauth_client_resources IS
  'Authoritative registry of dedicated OAuth clients allowed to receive a Tender Flow MCP resource claim.';

COMMENT ON FUNCTION public.tender_flow_access_token_hook(JSONB) IS
  'Auth hook: adds the canonical MCP resource only for enabled dedicated MCP OAuth clients.';

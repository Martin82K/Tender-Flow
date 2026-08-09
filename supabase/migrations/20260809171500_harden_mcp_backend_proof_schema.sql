-- Keep the MCP backend proof outside every Data API exposed schema. The
-- public registration RPC remains the only rotation entry point and is
-- executable exclusively by service_role.

CREATE SCHEMA IF NOT EXISTS mcp_private;

REVOKE ALL ON SCHEMA mcp_private
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
GRANT USAGE ON SCHEMA mcp_private
  TO anon, authenticated, service_role, tenderflow_mcp_client;

ALTER TABLE public.mcp_backend_proof SET SCHEMA mcp_private;
ALTER FUNCTION public.mcp_backend_proof_is_valid() SET SCHEMA mcp_private;

REVOKE ALL ON TABLE mcp_private.mcp_backend_proof
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;

CREATE OR REPLACE FUNCTION public.register_mcp_backend_proof(proof_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_proof TEXT := LOWER(BTRIM(COALESCE(proof_input, '')));
BEGIN
  IF normalized_proof !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid MCP backend proof format' USING ERRCODE = '22023';
  END IF;

  INSERT INTO mcp_private.mcp_backend_proof (singleton, proof_hash, updated_at)
  VALUES (true, normalized_proof, NOW())
  ON CONFLICT (singleton) DO UPDATE
  SET proof_hash = EXCLUDED.proof_hash,
      updated_at = NOW();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_mcp_backend_proof(TEXT)
  FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.register_mcp_backend_proof(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION mcp_private.mcp_backend_proof_is_valid()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mcp_private.mcp_backend_proof AS configured
    WHERE configured.singleton = true
      AND configured.proof_hash = LOWER(BTRIM(COALESCE(
        NULLIF(current_setting('request.headers', true), ''),
        '{}'
      )::JSONB ->> 'x-tenderflow-mcp-proof'))
  );
$$;

REVOKE ALL ON FUNCTION mcp_private.mcp_backend_proof_is_valid()
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION mcp_private.mcp_backend_proof_is_valid()
  TO anon, authenticated, service_role, tenderflow_mcp_client;

CREATE OR REPLACE FUNCTION public.enforce_mcp_backend_boundary()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  jwt_client_id TEXT := public.mcp_current_client_id();
BEGIN
  IF current_user = 'tenderflow_mcp_client'
    OR jwt_client_id IS NOT NULL THEN
    IF NOT mcp_private.mcp_backend_proof_is_valid() THEN
      RAISE EXCEPTION 'MCP database access is restricted to the trusted tool backend.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF current_user = 'tenderflow_mcp_client' THEN
    IF NOT public.mcp_has_permission('tenderflow.read') THEN
      RAISE EXCEPTION 'MCP OAuth client is not enabled or consented.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_mcp_backend_boundary()
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.enforce_mcp_backend_boundary()
  TO anon, authenticated, service_role, tenderflow_mcp_client;

COMMENT ON SCHEMA mcp_private IS
  'Private Tender Flow MCP helpers and secrets; intentionally excluded from PostgREST exposed schemas.';
COMMENT ON TABLE mcp_private.mcp_backend_proof IS
  'Exact proof derived from the server-only MCP key; accessible only through tightly granted security-definer helpers.';
COMMENT ON FUNCTION mcp_private.mcp_backend_proof_is_valid() IS
  'Validates the exact MCP backend proof from the trusted backend request header; not exposed through the Data API.';

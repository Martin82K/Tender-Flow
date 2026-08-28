-- A refresh-token hook event may omit client_id even though the underlying
-- Supabase Auth session is still bound to an OAuth client. Recover that binding
-- only from the same user's session, then apply the existing MCP allowlist and
-- canonical resource checks before granting the isolated database role.

CREATE OR REPLACE FUNCTION public.tender_flow_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims JSONB := COALESCE(event -> 'claims', '{}'::JSONB);
  session_id TEXT := NULLIF(BTRIM(claims ->> 'session_id'), '');
  session_uuid UUID;
  subject_uuid UUID;
  oauth_client_id TEXT := COALESCE(
    NULLIF(BTRIM(claims ->> 'client_id'), ''),
    NULLIF(BTRIM(event ->> 'client_id'), '')
  );
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
  mcp_client_is_registered BOOLEAN := false;
BEGIN
  IF oauth_client_id IS NULL AND session_id IS NOT NULL THEN
    BEGIN
      session_uuid := session_id::UUID;
      subject_uuid := NULLIF(BTRIM(claims ->> 'sub'), '')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN JSONB_BUILD_OBJECT('claims', claims);
    END;

    SELECT oauth_session.oauth_client_id::TEXT
    INTO oauth_client_id
    FROM auth.sessions AS oauth_session
    WHERE oauth_session.id = session_uuid
      AND oauth_session.user_id = subject_uuid
      AND oauth_session.oauth_client_id IS NOT NULL
    LIMIT 1;
  END IF;

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

  claims := JSONB_SET(claims, '{client_id}', TO_JSONB(oauth_client_id), true);
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
  'Assigns the isolated MCP role and resource to registered OAuth clients, recovering refresh-event client_id only from the same user session.';

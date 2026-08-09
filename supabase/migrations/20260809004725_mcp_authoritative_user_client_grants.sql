-- Authoritative MCP permissions are deliberately separate from OAuth scopes.
-- A permission is bound to the authenticated user and one registered OAuth
-- client, expires automatically, can be revoked immediately, and is resolved
-- on every MCP request. Domain RLS/RPC remains authoritative underneath it.

CREATE TABLE public.mcp_user_client_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.oauth_clients(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (
    permission IN ('tenderflow.contacts.read', 'tenderflow.write')
  ),
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id, permission),
  CHECK (
    (enabled = true AND revoked_at IS NULL)
    OR (enabled = false AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX idx_mcp_user_client_grants_active
  ON public.mcp_user_client_grants(user_id, client_id, permission, expires_at)
  WHERE enabled = true AND revoked_at IS NULL;

CREATE TABLE public.mcp_permission_grant_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.oauth_clients(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (
    permission IN ('tenderflow.contacts.read', 'tenderflow.write')
  ),
  action TEXT NOT NULL CHECK (action IN ('grant', 'renew', 'revoke')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_state JSONB,
  new_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_permission_grant_audit_user_created
  ON public.mcp_permission_grant_audit(user_id, created_at DESC);

ALTER TABLE public.mcp_user_client_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_permission_grant_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_user_client_grants
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_permission_grant_audit
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.mcp_user_client_grants FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mcp_user_client_grants TO service_role;
REVOKE ALL ON TABLE public.mcp_permission_grant_audit FROM service_role;
GRANT SELECT, INSERT ON TABLE public.mcp_permission_grant_audit TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_mcp_permissions(client_id_input UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  jwt_client_id TEXT := COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
  resolved_permissions TEXT[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF jwt_client_id IS NULL OR jwt_client_id <> client_id_input::TEXT THEN
    RAISE EXCEPTION 'OAuth client mismatch' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mcp_oauth_client_resources AS resource_grant
    JOIN auth.oauth_clients AS oauth_client
      ON oauth_client.id = resource_grant.client_id
    JOIN auth.oauth_consents AS oauth_consent
      ON oauth_consent.client_id = resource_grant.client_id
     AND oauth_consent.user_id = caller_id
     AND oauth_consent.revoked_at IS NULL
    WHERE resource_grant.client_id = client_id_input
      AND resource_grant.resource = canonical_resource
      AND resource_grant.enabled = true
      AND oauth_client.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'MCP OAuth client is not enabled or consented'
      USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY['tenderflow.read']::TEXT[] || COALESCE(
    ARRAY_AGG(grant_row.permission ORDER BY grant_row.permission),
    ARRAY[]::TEXT[]
  )
  INTO resolved_permissions
  FROM public.mcp_user_client_grants AS grant_row
  WHERE grant_row.user_id = caller_id
    AND grant_row.client_id = client_id_input
    AND grant_row.enabled = true
    AND grant_row.revoked_at IS NULL
    AND grant_row.expires_at > NOW();

  RETURN resolved_permissions;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_mcp_client_grants()
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_uri TEXT,
  contacts_read_expires_at TIMESTAMPTZ,
  write_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  jwt_client_id TEXT := COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF jwt_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'MCP grant management requires a first-party Tender Flow session'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    oauth_client.id,
    COALESCE(oauth_client.client_name, 'MCP klient'),
    oauth_client.client_uri,
    MAX(grant_row.expires_at) FILTER (
      WHERE grant_row.permission = 'tenderflow.contacts.read'
        AND grant_row.enabled = true
        AND grant_row.revoked_at IS NULL
        AND grant_row.expires_at > NOW()
    ),
    MAX(grant_row.expires_at) FILTER (
      WHERE grant_row.permission = 'tenderflow.write'
        AND grant_row.enabled = true
        AND grant_row.revoked_at IS NULL
        AND grant_row.expires_at > NOW()
    )
  FROM public.mcp_oauth_client_resources AS resource_grant
  JOIN auth.oauth_clients AS oauth_client
    ON oauth_client.id = resource_grant.client_id
  JOIN auth.oauth_consents AS oauth_consent
    ON oauth_consent.client_id = resource_grant.client_id
   AND oauth_consent.user_id = caller_id
   AND oauth_consent.revoked_at IS NULL
  LEFT JOIN public.mcp_user_client_grants AS grant_row
    ON grant_row.user_id = caller_id
   AND grant_row.client_id = oauth_client.id
  WHERE resource_grant.resource = canonical_resource
    AND resource_grant.enabled = true
    AND oauth_client.deleted_at IS NULL
  GROUP BY oauth_client.id, oauth_client.client_name, oauth_client.client_uri
  ORDER BY COALESCE(oauth_client.client_name, 'MCP klient'), oauth_client.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_mcp_client_grant(
  client_id_input UUID,
  permission_input TEXT,
  enabled_input BOOLEAN
)
RETURNS TABLE (
  permission TEXT,
  enabled BOOLEAN,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  jwt_client_id TEXT := COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
  previous_row public.mcp_user_client_grants%ROWTYPE;
  next_expiry TIMESTAMPTZ;
  audit_action TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF jwt_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'MCP grant management requires a first-party Tender Flow session'
      USING ERRCODE = '42501';
  END IF;

  IF permission_input NOT IN ('tenderflow.contacts.read', 'tenderflow.write') THEN
    RAISE EXCEPTION 'Unsupported MCP permission' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mcp_oauth_client_resources AS resource_grant
    JOIN auth.oauth_clients AS oauth_client
      ON oauth_client.id = resource_grant.client_id
    JOIN auth.oauth_consents AS oauth_consent
      ON oauth_consent.client_id = resource_grant.client_id
     AND oauth_consent.user_id = caller_id
     AND oauth_consent.revoked_at IS NULL
    WHERE resource_grant.client_id = client_id_input
      AND resource_grant.resource = canonical_resource
      AND resource_grant.enabled = true
      AND oauth_client.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'MCP OAuth client is not enabled' USING ERRCODE = '42501';
  END IF;

  SELECT grant_row.*
  INTO previous_row
  FROM public.mcp_user_client_grants AS grant_row
  WHERE grant_row.user_id = caller_id
    AND grant_row.client_id = client_id_input
    AND grant_row.permission = permission_input
  FOR UPDATE;

  IF enabled_input THEN
    next_expiry := NOW() + CASE permission_input
      WHEN 'tenderflow.contacts.read' THEN INTERVAL '30 days'
      WHEN 'tenderflow.write' THEN INTERVAL '8 hours'
    END;
    audit_action := CASE
      WHEN previous_row.user_id IS NULL
        OR previous_row.enabled = false
        OR previous_row.expires_at <= NOW()
        THEN 'grant'
      ELSE 'renew'
    END;

    INSERT INTO public.mcp_user_client_grants (
      user_id,
      client_id,
      permission,
      enabled,
      granted_by,
      granted_at,
      expires_at,
      revoked_at,
      updated_at
    ) VALUES (
      caller_id,
      client_id_input,
      permission_input,
      true,
      caller_id,
      NOW(),
      next_expiry,
      NULL,
      NOW()
    )
    ON CONFLICT ON CONSTRAINT mcp_user_client_grants_pkey DO UPDATE SET
      enabled = true,
      granted_by = caller_id,
      granted_at = NOW(),
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL,
      updated_at = NOW();
  ELSE
    next_expiry := NOW();
    audit_action := 'revoke';

    INSERT INTO public.mcp_user_client_grants (
      user_id,
      client_id,
      permission,
      enabled,
      granted_by,
      granted_at,
      expires_at,
      revoked_at,
      updated_at
    ) VALUES (
      caller_id,
      client_id_input,
      permission_input,
      false,
      caller_id,
      NOW(),
      next_expiry,
      NOW(),
      NOW()
    )
    ON CONFLICT ON CONSTRAINT mcp_user_client_grants_pkey DO UPDATE SET
      enabled = false,
      revoked_at = NOW(),
      expires_at = NOW(),
      updated_at = NOW();
  END IF;

  INSERT INTO public.mcp_permission_grant_audit (
    user_id,
    client_id,
    permission,
    action,
    actor_user_id,
    previous_state,
    new_state
  ) VALUES (
    caller_id,
    client_id_input,
    permission_input,
    audit_action,
    caller_id,
    CASE WHEN previous_row.user_id IS NULL THEN NULL ELSE JSONB_BUILD_OBJECT(
      'enabled', previous_row.enabled,
      'expires_at', previous_row.expires_at,
      'revoked_at', previous_row.revoked_at
    ) END,
    JSONB_BUILD_OBJECT(
      'enabled', enabled_input,
      'expires_at', CASE WHEN enabled_input THEN next_expiry ELSE NULL END,
      'revoked_at', CASE WHEN enabled_input THEN NULL ELSE NOW() END
    )
  );

  RETURN QUERY
  SELECT
    permission_input,
    enabled_input,
    CASE WHEN enabled_input THEN next_expiry ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_mcp_permissions(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_mcp_client_grants()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_mcp_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_mcp_client_grants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON TABLE public.mcp_user_client_grants IS
  'Expiring user+OAuth-client grants for elevated Tender Flow MCP permissions.';
COMMENT ON TABLE public.mcp_permission_grant_audit IS
  'Append-only audit trail for MCP permission grants, renewals and revocations.';
COMMENT ON FUNCTION public.get_my_mcp_permissions(UUID) IS
  'Resolves current MCP permissions for the authenticated OAuth user and exact token client.';
COMMENT ON FUNCTION public.list_my_mcp_client_grants() IS
  'Lists consented registered MCP clients and active elevated grants for auth.uid(); callable only from a first-party Tender Flow session.';
COMMENT ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN) IS
  'Grants, renews or revokes one expiring elevated MCP permission for auth.uid() and an actively consented client; callable only from a first-party Tender Flow session.';

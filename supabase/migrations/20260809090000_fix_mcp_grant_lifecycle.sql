-- Bind elevated MCP grants to one concrete OAuth consent generation, preserve
-- audit history after client deletion, and serialize first-time grant writes.

ALTER TABLE public.mcp_user_client_grants
  ADD COLUMN consent_id UUID,
  ADD COLUMN consent_granted_at TIMESTAMPTZ;

WITH latest_consent AS (
  SELECT DISTINCT ON (oauth_consent.user_id, oauth_consent.client_id)
    oauth_consent.user_id,
    oauth_consent.client_id,
    oauth_consent.id,
    oauth_consent.granted_at,
    oauth_consent.revoked_at
  FROM auth.oauth_consents AS oauth_consent
  ORDER BY
    oauth_consent.user_id,
    oauth_consent.client_id,
    oauth_consent.granted_at DESC,
    oauth_consent.id
)
UPDATE public.mcp_user_client_grants AS grant_row
SET
  consent_id = latest_consent.id,
  consent_granted_at = latest_consent.granted_at,
  enabled = CASE
    WHEN latest_consent.revoked_at IS NULL THEN grant_row.enabled
    ELSE false
  END,
  revoked_at = CASE
    WHEN latest_consent.revoked_at IS NULL THEN grant_row.revoked_at
    ELSE COALESCE(grant_row.revoked_at, NOW())
  END,
  expires_at = CASE
    WHEN latest_consent.revoked_at IS NULL THEN grant_row.expires_at
    ELSE LEAST(grant_row.expires_at, NOW())
  END,
  updated_at = NOW()
FROM latest_consent
WHERE latest_consent.user_id = grant_row.user_id
  AND latest_consent.client_id = grant_row.client_id;

-- A grant without any matching consent has no valid authorization basis.
DELETE FROM public.mcp_user_client_grants AS grant_row
WHERE grant_row.consent_id IS NULL;

ALTER TABLE public.mcp_user_client_grants
  ALTER COLUMN consent_id SET NOT NULL,
  ALTER COLUMN consent_granted_at SET NOT NULL;

-- client_id is an immutable audit snapshot. A deleted OAuth client must not
-- cascade-delete the forensic permission history.
ALTER TABLE public.mcp_permission_grant_audit
  DROP CONSTRAINT IF EXISTS mcp_permission_grant_audit_client_id_fkey;

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
  JOIN auth.oauth_consents AS oauth_consent
    ON oauth_consent.id = grant_row.consent_id
   AND oauth_consent.user_id = grant_row.user_id
   AND oauth_consent.client_id = grant_row.client_id
   AND oauth_consent.granted_at = grant_row.consent_granted_at
   AND oauth_consent.revoked_at IS NULL
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
   AND grant_row.consent_id = oauth_consent.id
   AND grant_row.consent_granted_at = oauth_consent.granted_at
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
  active_consent_id UUID;
  active_consent_granted_at TIMESTAMPTZ;
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      caller_id::TEXT || ':' || client_id_input::TEXT || ':' || permission_input,
      0
    )
  );

  SELECT oauth_consent.id, oauth_consent.granted_at
  INTO active_consent_id, active_consent_granted_at
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
  FOR SHARE OF oauth_consent;

  IF active_consent_id IS NULL THEN
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
        OR previous_row.consent_id IS DISTINCT FROM active_consent_id
        OR previous_row.consent_granted_at IS DISTINCT FROM active_consent_granted_at
        THEN 'grant'
      ELSE 'renew'
    END;

    INSERT INTO public.mcp_user_client_grants (
      user_id, client_id, consent_id, consent_granted_at, permission, enabled,
      granted_by, granted_at, expires_at, revoked_at, updated_at
    ) VALUES (
      caller_id, client_id_input, active_consent_id, active_consent_granted_at,
      permission_input, true, caller_id, NOW(), next_expiry, NULL, NOW()
    )
    ON CONFLICT ON CONSTRAINT mcp_user_client_grants_pkey DO UPDATE SET
      consent_id = EXCLUDED.consent_id,
      consent_granted_at = EXCLUDED.consent_granted_at,
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
      user_id, client_id, consent_id, consent_granted_at, permission, enabled,
      granted_by, granted_at, expires_at, revoked_at, updated_at
    ) VALUES (
      caller_id, client_id_input, active_consent_id, active_consent_granted_at,
      permission_input, false, caller_id, NOW(), next_expiry, NOW(), NOW()
    )
    ON CONFLICT ON CONSTRAINT mcp_user_client_grants_pkey DO UPDATE SET
      consent_id = EXCLUDED.consent_id,
      consent_granted_at = EXCLUDED.consent_granted_at,
      enabled = false,
      revoked_at = NOW(),
      expires_at = NOW(),
      updated_at = NOW();
  END IF;

  INSERT INTO public.mcp_permission_grant_audit (
    user_id, client_id, permission, action, actor_user_id, previous_state, new_state
  ) VALUES (
    caller_id,
    client_id_input,
    permission_input,
    audit_action,
    caller_id,
    CASE WHEN previous_row.user_id IS NULL THEN NULL ELSE JSONB_BUILD_OBJECT(
      'enabled', previous_row.enabled,
      'consent_id', previous_row.consent_id,
      'consent_granted_at', previous_row.consent_granted_at,
      'expires_at', previous_row.expires_at,
      'revoked_at', previous_row.revoked_at
    ) END,
    JSONB_BUILD_OBJECT(
      'enabled', enabled_input,
      'consent_id', active_consent_id,
      'consent_granted_at', active_consent_granted_at,
      'expires_at', CASE WHEN enabled_input THEN next_expiry ELSE NULL END,
      'revoked_at', CASE WHEN enabled_input THEN NULL ELSE NOW() END
    )
  );

  RETURN QUERY
  SELECT permission_input, enabled_input,
    CASE WHEN enabled_input THEN next_expiry ELSE NULL END;
END;
$$;

COMMENT ON COLUMN public.mcp_user_client_grants.consent_id IS
  'Snapshot of the OAuth consent row that authorized this elevated grant.';
COMMENT ON COLUMN public.mcp_user_client_grants.consent_granted_at IS
  'Consent generation timestamp; reauthorization does not reactivate an older grant.';
COMMENT ON COLUMN public.mcp_permission_grant_audit.client_id IS
  'Immutable OAuth client identifier snapshot retained after client deletion.';

-- MCP OAuth access tokens must not be general Tender Flow database credentials.
-- The token receives a dedicated NOINHERIT role with access only to the exact
-- relations and functions used by the MCP tool implementation. PostgREST also
-- requires a valid server-only Supabase secret API key, which is held solely by
-- the trusted MCP backend. The user JWT remains the Authorization credential so
-- auth.uid(), tenant RLS, consent, and per-client grants stay authoritative.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenderflow_mcp_client') THEN
    CREATE ROLE tenderflow_mcp_client NOLOGIN NOINHERIT;
  END IF;
END;
$$;

GRANT tenderflow_mcp_client TO authenticator;

REVOKE ALL ON SCHEMA storage FROM tenderflow_mcp_client;
REVOKE ALL ON SCHEMA realtime FROM tenderflow_mcp_client;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM tenderflow_mcp_client;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM tenderflow_mcp_client;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM tenderflow_mcp_client;

GRANT USAGE ON SCHEMA public, auth TO tenderflow_mcp_client;

CREATE OR REPLACE FUNCTION public.mcp_has_permission(permission_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  jwt_role TEXT := NULLIF(BTRIM(auth.jwt() ->> 'role'), '');
  jwt_client_id TEXT := COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
  canonical_resource CONSTANT TEXT := 'https://www.tenderflow.cz/api/mcp';
BEGIN
  IF caller_id IS NULL
    OR jwt_role IS DISTINCT FROM 'tenderflow_mcp_client'
    OR jwt_client_id IS NULL
    OR permission_input NOT IN (
      'tenderflow.read',
      'tenderflow.contacts.read',
      'tenderflow.write'
    )
  THEN
    RETURN false;
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
    WHERE resource_grant.client_id::TEXT = jwt_client_id
      AND resource_grant.resource = canonical_resource
      AND resource_grant.enabled = true
      AND oauth_client.deleted_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  IF permission_input = 'tenderflow.read' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.mcp_user_client_grants AS grant_row
    WHERE grant_row.user_id = caller_id
      AND grant_row.client_id::TEXT = jwt_client_id
      AND grant_row.permission = permission_input
      AND grant_row.enabled = true
      AND grant_row.revoked_at IS NULL
      AND grant_row.expires_at > NOW()
      AND EXISTS (
        SELECT 1
        FROM auth.oauth_consents AS oauth_consent
        WHERE oauth_consent.id = grant_row.consent_id
          AND oauth_consent.user_id = caller_id
          AND oauth_consent.client_id = grant_row.client_id
          AND oauth_consent.granted_at = grant_row.consent_granted_at
          AND oauth_consent.revoked_at IS NULL
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_has_permission(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_has_permission(TEXT)
  TO tenderflow_mcp_client;

CREATE OR REPLACE FUNCTION public.enforce_mcp_backend_boundary()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  request_headers JSONB := COALESCE(
    NULLIF(current_setting('request.headers', true), ''),
    '{}'
  )::JSONB;
  api_key TEXT := COALESCE(request_headers ->> 'apikey', '');
  jwt_client_id TEXT := COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
BEGIN
  -- Gate both newly issued dedicated-role tokens and already-issued OAuth
  -- tokens whose signed role claim is still `authenticated`. This closes the
  -- rollout window without affecting first-party sessions, which have no
  -- OAuth client_id/azp claim.
  IF current_user = 'tenderflow_mcp_client'
    OR jwt_client_id IS NOT NULL THEN
    IF api_key !~ '^sb_secret_' THEN
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
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_mcp_backend_boundary()
  TO anon, authenticated, service_role, tenderflow_mcp_client;

DO $$
DECLARE
  existing_pre_request TEXT;
BEGIN
  SELECT SUBSTRING(setting FROM LENGTH('pgrst.db_pre_request=') + 1)
  INTO existing_pre_request
  FROM pg_db_role_setting AS role_setting
  CROSS JOIN LATERAL UNNEST(role_setting.setconfig) AS setting
  WHERE role_setting.setrole = 'authenticator'::REGROLE
    AND setting LIKE 'pgrst.db_pre_request=%'
  LIMIT 1;

  IF existing_pre_request IS NOT NULL
    AND existing_pre_request <> 'public.enforce_mcp_backend_boundary'
  THEN
    RAISE EXCEPTION
      'Refusing to replace existing pgrst.db_pre_request hook: %',
      existing_pre_request;
  END IF;
END;
$$;

ALTER ROLE authenticator
  SET pgrst.db_pre_request = 'public.enforce_mcp_backend_boundary';
NOTIFY pgrst, 'reload config';

-- Storage and Realtime do not execute PostgREST's db_pre_request hook. Deny
-- every OAuth-client JWT that still carries the legacy authenticated role;
-- first-party Tender Flow sessions have no client_id/azp and remain unchanged.
DROP POLICY IF EXISTS "block_oauth_client_direct_access"
  ON storage.objects;
CREATE POLICY "block_oauth_client_direct_access"
  ON storage.objects AS RESTRICTIVE
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

DO $$
DECLARE
  publication RECORD;
  policy_name CONSTANT TEXT := 'block_oauth_client_direct_access';
BEGIN
  FOR publication IN
    SELECT
      published.schemaname,
      published.tablename,
      relation.relrowsecurity AS rls_enabled
    FROM pg_catalog.pg_publication_tables AS published
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.nspname = published.schemaname
    JOIN pg_catalog.pg_class AS relation
      ON relation.relnamespace = namespace.oid
     AND relation.relname = published.tablename
    WHERE published.pubname = 'supabase_realtime'
  LOOP
    IF NOT publication.rls_enabled THEN
      RAISE EXCEPTION
        'Refusing MCP rollout: Realtime relation %.% has RLS disabled.',
        publication.schemaname,
        publication.tablename;
    END IF;

    EXECUTE FORMAT(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_name,
      publication.schemaname,
      publication.tablename
    );
    EXECUTE FORMAT(
      $policy$
        CREATE POLICY %I ON %I.%I AS RESTRICTIVE
        FOR ALL TO authenticated
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
        )
      $policy$,
      policy_name,
      publication.schemaname,
      publication.tablename
    );
  END LOOP;
END;
$$;

-- Only the relations required by the current MCP tool implementation.
GRANT SELECT ON TABLE
  public.projects,
  public.demand_categories,
  public.bids,
  public.contracts,
  public.tender_plans,
  public.subcontractors
TO tenderflow_mcp_client;

GRANT SELECT, INSERT ON TABLE public.tasks TO tenderflow_mcp_client;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mcp_change_proposals
  TO tenderflow_mcp_client;
GRANT SELECT, INSERT ON TABLE public.mcp_idempotency_keys
  TO tenderflow_mcp_client;
GRANT INSERT ON TABLE public.mcp_audit_events TO tenderflow_mcp_client;

GRANT EXECUTE ON FUNCTION public.get_my_mcp_permissions(UUID)
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.consume_mcp_rate_limit(TEXT, TEXT)
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.get_contract_overview(UUID, BOOLEAN)
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.can_project_action(TEXT, TEXT)
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.can_project_module_action(TEXT, TEXT, BOOLEAN)
  TO tenderflow_mcp_client;

CREATE POLICY "mcp_projects_select"
  ON public.projects
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND public.can_project_action(id::TEXT, 'view')
  );

CREATE POLICY "mcp_demand_categories_select"
  ON public.demand_categories
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND public.can_project_module_action(project_id::TEXT, 'module_pipeline', false)
  );

CREATE POLICY "mcp_bids_select"
  ON public.bids
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND public.can_project_module_action(
      (SELECT category.project_id::TEXT
       FROM public.demand_categories AS category
       WHERE category.id::TEXT = bids.demand_category_id::TEXT),
      'module_pipeline',
      false
    )
  );

CREATE POLICY "mcp_contracts_select"
  ON public.contracts
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND public.can_project_module_action(project_id::TEXT, 'module_contracts', false)
  );

CREATE POLICY "mcp_tender_plans_select"
  ON public.tender_plans
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND public.can_project_module_action(project_id::TEXT, 'module_pipeline', false)
  );

CREATE POLICY "mcp_subcontractors_select"
  ON public.subcontractors
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.contacts.read')
    AND (
      owner_id = auth.uid()
      OR (
        organization_id IS NOT NULL
        AND organization_id = ANY(public.get_my_org_ids())
      )
    )
  );

CREATE POLICY "mcp_tasks_select"
  ON public.tasks
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND created_by = auth.uid()
  );

CREATE POLICY "mcp_tasks_insert"
  ON public.tasks
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND created_by = auth.uid()
    AND (
      project_id IS NULL
      OR public.can_project_action(project_id::TEXT, 'view')
    )
  );

CREATE POLICY "mcp_change_proposals_select"
  ON public.mcp_change_proposals
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

CREATE POLICY "mcp_change_proposals_insert"
  ON public.mcp_change_proposals
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

CREATE POLICY "mcp_change_proposals_update"
  ON public.mcp_change_proposals
  FOR UPDATE
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  )
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

CREATE POLICY "mcp_idempotency_keys_select"
  ON public.mcp_idempotency_keys
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

CREATE POLICY "mcp_idempotency_keys_insert"
  ON public.mcp_idempotency_keys
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

CREATE POLICY "mcp_audit_events_insert"
  ON public.mcp_audit_events
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.read')
    AND user_id = auth.uid()
    AND client_id = COALESCE(auth.jwt() ->> 'client_id', auth.jwt() ->> 'azp')
  );

-- Remove legacy permissive contact policies. Their OR semantics defeated the
-- later tenant-aware policies for every ordinary authenticated session too.
DROP POLICY IF EXISTS "Enable read access for authenticated users"
  ON public.subcontractors;
DROP POLICY IF EXISTS "Enable insert access for authenticated users"
  ON public.subcontractors;
DROP POLICY IF EXISTS "Enable update access for authenticated users"
  ON public.subcontractors;
DROP POLICY IF EXISTS "Enable delete access for authenticated users"
  ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_select_policy" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_insert_policy" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_update_policy" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_delete_policy" ON public.subcontractors;
DROP POLICY IF EXISTS "Users can insert subcontractors" ON public.subcontractors;

-- Recreate the canonical tenant policies so the migration is deterministic
-- even when an older environment is missing one of the safe policy revisions.
DROP POLICY IF EXISTS "Subcontractors visible to owner or org"
  ON public.subcontractors;
CREATE POLICY "Subcontractors visible to owner or org"
  ON public.subcontractors
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND organization_id = ANY(public.get_my_org_ids())
    )
  );

DROP POLICY IF EXISTS "Subcontractors insert restricted to owner or org"
  ON public.subcontractors;
CREATE POLICY "Subcontractors insert restricted to owner or org"
  ON public.subcontractors
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_subcontractor_tenant(owner_id, organization_id));

DROP POLICY IF EXISTS "Manage own or org subcontractors"
  ON public.subcontractors;
CREATE POLICY "Manage own or org subcontractors"
  ON public.subcontractors
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND organization_id = ANY(public.get_my_org_ids())
    )
  )
  WITH CHECK (public.can_write_subcontractor_tenant(owner_id, organization_id));

DROP POLICY IF EXISTS "Strict Subcontractor Delete"
  ON public.subcontractors;
CREATE POLICY "Strict Subcontractor Delete"
  ON public.subcontractors
  FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND organization_id = ANY(public.get_my_org_ids())
    )
  );

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
GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB)
  TO supabase_auth_admin;

COMMENT ON ROLE tenderflow_mcp_client IS
  'Dedicated NOINHERIT role for MCP OAuth JWTs; usable only by the trusted MCP tool backend.';
COMMENT ON FUNCTION public.enforce_mcp_backend_boundary() IS
  'PostgREST pre-request guard requiring the MCP backend server-only sb_secret API key.';
COMMENT ON FUNCTION public.mcp_has_permission(TEXT) IS
  'Resolves authoritative read, contacts, and write permissions for the current MCP OAuth JWT.';

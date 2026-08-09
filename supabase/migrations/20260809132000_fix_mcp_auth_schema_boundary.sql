-- Supabase owns the auth schema with supabase_admin. The regular migration
-- role cannot delegate auth schema USAGE to a new database role. Keep the MCP
-- role isolated from auth and expose only the two signed-request identities
-- that MCP RLS and the PostgREST pre-request guard require.

CREATE OR REPLACE FUNCTION public.mcp_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mcp_current_client_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(auth.jwt() ->> 'client_id'), ''),
    NULLIF(BTRIM(auth.jwt() ->> 'azp'), '')
  );
$$;

REVOKE ALL ON FUNCTION public.mcp_current_user_id()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_current_client_id()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mcp_current_user_id()
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.mcp_current_client_id()
  TO anon, authenticated, service_role, tenderflow_mcp_client;

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
  jwt_client_id TEXT := public.mcp_current_client_id();
BEGIN
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

DROP POLICY IF EXISTS "mcp_subcontractors_select" ON public.subcontractors;
CREATE POLICY "mcp_subcontractors_select"
  ON public.subcontractors
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.contacts.read')
    AND (
      owner_id = public.mcp_current_user_id()
      OR (
        organization_id IS NOT NULL
        AND organization_id = ANY(public.get_my_org_ids())
      )
    )
  );

DROP POLICY IF EXISTS "mcp_tasks_select" ON public.tasks;
CREATE POLICY "mcp_tasks_select"
  ON public.tasks
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.read')
    AND created_by = public.mcp_current_user_id()
  );

DROP POLICY IF EXISTS "mcp_tasks_insert" ON public.tasks;
CREATE POLICY "mcp_tasks_insert"
  ON public.tasks
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND created_by = public.mcp_current_user_id()
    AND (
      project_id IS NULL
      OR public.can_project_action(project_id::TEXT, 'view')
    )
  );

DROP POLICY IF EXISTS "mcp_change_proposals_select" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_select"
  ON public.mcp_change_proposals
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

DROP POLICY IF EXISTS "mcp_change_proposals_insert" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_insert"
  ON public.mcp_change_proposals
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

DROP POLICY IF EXISTS "mcp_change_proposals_update" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_update"
  ON public.mcp_change_proposals
  FOR UPDATE
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  )
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

DROP POLICY IF EXISTS "mcp_idempotency_keys_select" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_keys_select"
  ON public.mcp_idempotency_keys
  FOR SELECT
  TO tenderflow_mcp_client
  USING (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

DROP POLICY IF EXISTS "mcp_idempotency_keys_insert" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_keys_insert"
  ON public.mcp_idempotency_keys
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.write')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

DROP POLICY IF EXISTS "mcp_audit_events_insert" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_events_insert"
  ON public.mcp_audit_events
  FOR INSERT
  TO tenderflow_mcp_client
  WITH CHECK (
    public.mcp_has_permission('tenderflow.read')
    AND user_id = public.mcp_current_user_id()
    AND client_id = public.mcp_current_client_id()
  );

COMMENT ON FUNCTION public.mcp_current_user_id() IS
  'Returns auth.uid() to the isolated MCP role without granting auth schema USAGE.';
COMMENT ON FUNCTION public.mcp_current_client_id() IS
  'Returns the signed OAuth client claim without granting auth schema USAGE.';

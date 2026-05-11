-- =====================================================
-- MCP state RLS hardening
-- Bind MCP audit/proposal/idempotency rows to both auth.uid()
-- and the OAuth client_id carried in the JWT.
-- =====================================================

DROP POLICY IF EXISTS "mcp_audit_insert_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_insert_own" ON public.mcp_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_audit_select_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_select_own" ON public.mcp_audit_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_change_proposals_insert_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_insert_own" ON public.mcp_change_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_change_proposals_select_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_select_own" ON public.mcp_change_proposals
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_change_proposals_update_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_update_own" ON public.mcp_change_proposals
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_idempotency_insert_own" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_insert_own" ON public.mcp_idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

DROP POLICY IF EXISTS "mcp_idempotency_select_own" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_select_own" ON public.mcp_idempotency_keys
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND client_id = (auth.jwt() ->> 'client_id')
  );

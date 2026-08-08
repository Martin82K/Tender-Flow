-- Allow the documented local read-only MCP bridge to retain its audit trail.
-- OAuth-backed rows remain bound to the client_id claim. The local exception
-- applies only to the canonical local-stdio id and tokens with no OAuth client.

DROP POLICY IF EXISTS "mcp_audit_insert_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_insert_own" ON public.mcp_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      client_id = (auth.jwt() ->> 'client_id')
      OR (
        auth.jwt() ->> 'client_id' IS NULL
        AND auth.jwt() ->> 'azp' IS NULL
        AND client_id = 'local-stdio'
      )
    )
  );

DROP POLICY IF EXISTS "mcp_audit_select_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_select_own" ON public.mcp_audit_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      client_id = (auth.jwt() ->> 'client_id')
      OR (
        auth.jwt() ->> 'client_id' IS NULL
        AND auth.jwt() ->> 'azp' IS NULL
        AND client_id = 'local-stdio'
      )
    )
  );

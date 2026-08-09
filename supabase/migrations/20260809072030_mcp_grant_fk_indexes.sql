-- Cover non-leading foreign keys introduced by the MCP grant model. These
-- indexes keep OAuth client/user deletion and FK validation from scanning the
-- full grant or audit tables as their history grows.

CREATE INDEX IF NOT EXISTS idx_mcp_user_client_grants_client_id
  ON public.mcp_user_client_grants(client_id);

CREATE INDEX IF NOT EXISTS idx_mcp_user_client_grants_granted_by
  ON public.mcp_user_client_grants(granted_by);

CREATE INDEX IF NOT EXISTS idx_mcp_permission_grant_audit_client_id
  ON public.mcp_permission_grant_audit(client_id);

CREATE INDEX IF NOT EXISTS idx_mcp_permission_grant_audit_actor_user_id
  ON public.mcp_permission_grant_audit(actor_user_id);

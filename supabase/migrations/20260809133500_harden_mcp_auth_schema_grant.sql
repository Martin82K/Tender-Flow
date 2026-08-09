-- A previous migration attempted to grant auth schema USAGE to the isolated
-- MCP role. Supabase-managed projects reject that grant, but self-hosted or
-- differently owned installations may have accepted it. Remove the historical
-- privilege without relying on the migration runner owning the auth schema,
-- then fail closed if any effective USAGE privilege remains.

DO $migration$
BEGIN
  IF pg_catalog.to_regrole('tenderflow_mcp_client') IS NULL THEN
    RAISE EXCEPTION 'Required role tenderflow_mcp_client does not exist';
  END IF;

  BEGIN
    EXECUTE 'REVOKE USAGE ON SCHEMA auth FROM tenderflow_mcp_client';
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- Supabase owns auth with supabase_admin. A runner that cannot revoke a
      -- privilege also cannot have created the direct grant in that setup.
      NULL;
  END;

  IF pg_catalog.has_schema_privilege(
    'tenderflow_mcp_client',
    'auth',
    'USAGE'
  ) THEN
    RAISE EXCEPTION
      'MCP database boundary violation: tenderflow_mcp_client retains auth schema USAGE';
  END IF;
END;
$migration$;

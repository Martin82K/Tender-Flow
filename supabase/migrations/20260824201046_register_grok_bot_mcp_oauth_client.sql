-- Register the manually provisioned public OAuth client used by Grok Bot.
-- The Auth client must already exist and remain active; otherwise fail closed
-- instead of creating an orphaned or misleading MCP resource grant.

DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  INSERT INTO public.mcp_oauth_client_resources (client_id, resource)
  SELECT
    oauth_client.id,
    'https://www.tenderflow.cz/api/mcp'
  FROM auth.oauth_clients AS oauth_client
  WHERE oauth_client.id = '4873186f-4d54-4099-bbed-659119e7c629'
    AND oauth_client.deleted_at IS NULL
  ON CONFLICT (client_id, resource) DO UPDATE
  SET
    enabled = true,
    updated_at = NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows <> 1 THEN
    RAISE EXCEPTION
      'Active Grok Bot OAuth client 4873186f-4d54-4099-bbed-659119e7c629 was not found';
  END IF;
END;
$$;

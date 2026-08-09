-- Minimal Outlook correlation state for the MCP workflow. The table stays in
-- the non-exposed mcp_private schema and can only be reached through the two
-- narrowly granted, user-bound RPCs below.

CREATE TABLE mcp_private.outlook_message_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_id TEXT NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  outlook_immutable_id TEXT NOT NULL,
  internet_message_id TEXT,
  conversation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT outlook_message_links_immutable_id_length
    CHECK (CHAR_LENGTH(outlook_immutable_id) BETWEEN 1 AND 2048),
  CONSTRAINT outlook_message_links_internet_id_length
    CHECK (internet_message_id IS NULL OR CHAR_LENGTH(internet_message_id) BETWEEN 1 AND 2048),
  CONSTRAINT outlook_message_links_conversation_id_length
    CHECK (conversation_id IS NULL OR CHAR_LENGTH(conversation_id) BETWEEN 1 AND 2048),
  CONSTRAINT outlook_message_links_user_immutable_unique
    UNIQUE (user_id, outlook_immutable_id)
);

CREATE UNIQUE INDEX outlook_message_links_user_internet_unique
  ON mcp_private.outlook_message_links (user_id, internet_message_id)
  WHERE internet_message_id IS NOT NULL;

CREATE INDEX outlook_message_links_user_conversation_idx
  ON mcp_private.outlook_message_links (user_id, conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX outlook_message_links_bid_idx
  ON mcp_private.outlook_message_links (bid_id);

ALTER TABLE mcp_private.outlook_message_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_private.outlook_message_links FORCE ROW LEVEL SECURITY;

CREATE POLICY outlook_message_links_deny_all
  ON mcp_private.outlook_message_links
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE mcp_private.outlook_message_links
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;

CREATE OR REPLACE FUNCTION public.link_mcp_outlook_message(
  bid_id_input TEXT,
  outlook_immutable_id_input TEXT,
  internet_message_id_input TEXT DEFAULT NULL,
  conversation_id_input TEXT DEFAULT NULL
)
RETURNS TABLE (
  bid_id TEXT,
  project_id TEXT,
  tender_id TEXT,
  linked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := public.mcp_current_user_id();
  normalized_bid_id TEXT := BTRIM(COALESCE(bid_id_input, ''));
  normalized_immutable_id TEXT := BTRIM(COALESCE(outlook_immutable_id_input, ''));
  normalized_internet_id TEXT := NULLIF(BTRIM(COALESCE(internet_message_id_input, '')), '');
  normalized_conversation_id TEXT := NULLIF(BTRIM(COALESCE(conversation_id_input, '')), '');
  resolved_project_id TEXT;
  resolved_tender_id TEXT;
  stored_link_id UUID;
BEGIN
  IF caller_id IS NULL
    OR public.mcp_current_client_id() IS NULL
    OR NOT public.mcp_has_permission('tenderflow.write')
  THEN
    RAISE EXCEPTION 'Not authorized to link Outlook messages.' USING ERRCODE = '42501';
  END IF;

  IF normalized_bid_id = ''
    OR normalized_immutable_id = ''
    OR CHAR_LENGTH(normalized_bid_id) > 100
    OR CHAR_LENGTH(normalized_immutable_id) > 2048
    OR CHAR_LENGTH(COALESCE(normalized_internet_id, '')) > 2048
    OR CHAR_LENGTH(COALESCE(normalized_conversation_id, '')) > 2048
  THEN
    RAISE EXCEPTION 'Invalid Outlook message link input.' USING ERRCODE = '22023';
  END IF;

  SELECT category.id::TEXT, category.project_id::TEXT
  INTO resolved_tender_id, resolved_project_id
  FROM public.bids AS bid
  JOIN public.demand_categories AS category
    ON category.id::TEXT = COALESCE(
      NULLIF(BTRIM(bid.demand_category_id::TEXT), ''),
      NULLIF(BTRIM(bid.category_id::TEXT), '')
    )
  WHERE bid.id::TEXT = normalized_bid_id;

  IF resolved_project_id IS NULL
    OR NOT public.can_project_module_action(resolved_project_id, 'module_pipeline', true)
  THEN
    RAISE EXCEPTION 'Bid is not writable by the authenticated user.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO mcp_private.outlook_message_links AS existing_link (
    user_id,
    bid_id,
    outlook_immutable_id,
    internet_message_id,
    conversation_id
  )
  VALUES (
    caller_id,
    normalized_bid_id,
    normalized_immutable_id,
    normalized_internet_id,
    normalized_conversation_id
  )
  ON CONFLICT (user_id, outlook_immutable_id) DO UPDATE
  SET internet_message_id = COALESCE(EXCLUDED.internet_message_id, existing_link.internet_message_id),
      conversation_id = COALESCE(EXCLUDED.conversation_id, existing_link.conversation_id),
      updated_at = NOW()
  WHERE existing_link.bid_id = EXCLUDED.bid_id
  RETURNING existing_link.id INTO stored_link_id;

  IF stored_link_id IS NULL THEN
    RAISE EXCEPTION 'Outlook message is already linked to a different bid.'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  SELECT normalized_bid_id, resolved_project_id, resolved_tender_id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_mcp_outlook_reply(
  outlook_immutable_id_input TEXT DEFAULT NULL,
  internet_message_id_input TEXT DEFAULT NULL,
  in_reply_to_internet_message_id_input TEXT DEFAULT NULL,
  conversation_id_input TEXT DEFAULT NULL
)
RETURNS TABLE (
  bid_id TEXT,
  project_id TEXT,
  project_name TEXT,
  tender_id TEXT,
  tender_title TEXT,
  company_name TEXT,
  bid_status TEXT,
  match_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := public.mcp_current_user_id();
  normalized_immutable_id TEXT := NULLIF(BTRIM(COALESCE(outlook_immutable_id_input, '')), '');
  normalized_internet_id TEXT := NULLIF(BTRIM(COALESCE(internet_message_id_input, '')), '');
  normalized_in_reply_to TEXT := NULLIF(BTRIM(COALESCE(in_reply_to_internet_message_id_input, '')), '');
  normalized_conversation_id TEXT := NULLIF(BTRIM(COALESCE(conversation_id_input, '')), '');
BEGIN
  IF caller_id IS NULL
    OR public.mcp_current_client_id() IS NULL
    OR NOT public.mcp_has_permission('tenderflow.contacts.read')
  THEN
    RAISE EXCEPTION 'Not authorized to match Outlook replies.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(
      normalized_immutable_id,
      normalized_internet_id,
      normalized_in_reply_to,
      normalized_conversation_id
    ) IS NULL
    OR CHAR_LENGTH(COALESCE(normalized_immutable_id, '')) > 2048
    OR CHAR_LENGTH(COALESCE(normalized_internet_id, '')) > 2048
    OR CHAR_LENGTH(COALESCE(normalized_in_reply_to, '')) > 2048
    OR CHAR_LENGTH(COALESCE(normalized_conversation_id, '')) > 2048
  THEN
    RAISE EXCEPTION 'At least one valid Outlook message identifier is required.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT
      link.bid_id,
      project.id::TEXT AS project_id,
      project.name::TEXT AS project_name,
      category.id::TEXT AS tender_id,
      category.title::TEXT AS tender_title,
      COALESCE(subcontractor.company_name, bid.company_name)::TEXT AS company_name,
      bid.status::TEXT AS bid_status,
      CASE
        WHEN normalized_immutable_id IS NOT NULL
          AND link.outlook_immutable_id = normalized_immutable_id THEN 'outlook_immutable_id'
        WHEN normalized_in_reply_to IS NOT NULL
          AND link.internet_message_id = normalized_in_reply_to THEN 'in_reply_to'
        WHEN normalized_internet_id IS NOT NULL
          AND link.internet_message_id = normalized_internet_id THEN 'internet_message_id'
        ELSE 'conversation_id'
      END AS match_type,
      CASE
        WHEN normalized_immutable_id IS NOT NULL
          AND link.outlook_immutable_id = normalized_immutable_id THEN 1
        WHEN normalized_in_reply_to IS NOT NULL
          AND link.internet_message_id = normalized_in_reply_to THEN 2
        WHEN normalized_internet_id IS NOT NULL
          AND link.internet_message_id = normalized_internet_id THEN 3
        ELSE 4
      END AS match_priority,
      link.created_at
    FROM mcp_private.outlook_message_links AS link
    JOIN public.bids AS bid ON bid.id::TEXT = link.bid_id
    JOIN public.demand_categories AS category
      ON category.id::TEXT = COALESCE(
        NULLIF(BTRIM(bid.demand_category_id::TEXT), ''),
        NULLIF(BTRIM(bid.category_id::TEXT), '')
      )
    JOIN public.projects AS project ON project.id::TEXT = category.project_id::TEXT
    LEFT JOIN public.subcontractors AS subcontractor
      ON subcontractor.id::TEXT = bid.subcontractor_id::TEXT
    WHERE link.user_id = caller_id
      AND (
        (normalized_immutable_id IS NOT NULL AND link.outlook_immutable_id = normalized_immutable_id)
        OR (normalized_in_reply_to IS NOT NULL AND link.internet_message_id = normalized_in_reply_to)
        OR (normalized_internet_id IS NOT NULL AND link.internet_message_id = normalized_internet_id)
        OR (normalized_conversation_id IS NOT NULL AND link.conversation_id = normalized_conversation_id)
      )
      AND public.can_project_module_action(project.id::TEXT, 'module_pipeline', false)
  ), deduplicated AS (
    SELECT DISTINCT ON (matched.bid_id)
      matched.*
    FROM matched
    ORDER BY matched.bid_id, matched.match_priority, matched.created_at DESC
  )
  SELECT
    deduplicated.bid_id,
    deduplicated.project_id,
    deduplicated.project_name,
    deduplicated.tender_id,
    deduplicated.tender_title,
    deduplicated.company_name,
    deduplicated.bid_status,
    deduplicated.match_type
  FROM deduplicated
  ORDER BY deduplicated.match_priority, deduplicated.created_at DESC
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.link_mcp_outlook_message(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_mcp_outlook_reply(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.link_mcp_outlook_message(TEXT, TEXT, TEXT, TEXT)
  TO tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.match_mcp_outlook_reply(TEXT, TEXT, TEXT, TEXT)
  TO tenderflow_mcp_client;

COMMENT ON TABLE mcp_private.outlook_message_links IS
  'Minimal per-user mapping from stable Outlook identifiers to Tender Flow bids; no message body or attachment content is stored.';
COMMENT ON FUNCTION public.link_mcp_outlook_message(TEXT, TEXT, TEXT, TEXT) IS
  'Idempotently links one immutable Outlook message to a writable Tender Flow bid.';
COMMENT ON FUNCTION public.match_mcp_outlook_reply(TEXT, TEXT, TEXT, TEXT) IS
  'Returns authorized bid candidates for Outlook reply identifiers without exposing stored message identifiers.';

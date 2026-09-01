-- Narrow MCP mutation for a supplier's total offer price excluding VAT and an
-- append-only note block. Direct UPDATE on bids remains unavailable to MCP.

ALTER TABLE public.mcp_user_client_grants
  DROP CONSTRAINT IF EXISTS mcp_user_client_grants_permission_check;
ALTER TABLE public.mcp_user_client_grants
  ADD CONSTRAINT mcp_user_client_grants_permission_check
  CHECK (permission IN (
    'tenderflow.contacts.read',
    'tenderflow.write',
    'tenderflow.bids.offer.write'
  ));

ALTER TABLE public.mcp_permission_grant_audit
  DROP CONSTRAINT IF EXISTS mcp_permission_grant_audit_permission_check;
ALTER TABLE public.mcp_permission_grant_audit
  ADD CONSTRAINT mcp_permission_grant_audit_permission_check
  CHECK (permission IN (
    'tenderflow.contacts.read',
    'tenderflow.write',
    'tenderflow.bids.offer.write'
  ));

DROP FUNCTION IF EXISTS public.list_my_mcp_client_grants();
CREATE FUNCTION public.list_my_mcp_client_grants()
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_uri TEXT,
  contacts_read_expires_at TIMESTAMPTZ,
  write_expires_at TIMESTAMPTZ,
  bid_offer_write_expires_at TIMESTAMPTZ
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
    ),
    MAX(grant_row.expires_at) FILTER (
      WHERE grant_row.permission = 'tenderflow.bids.offer.write'
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

REVOKE ALL ON FUNCTION public.list_my_mcp_client_grants()
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.list_my_mcp_client_grants() TO authenticated;

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
  IF permission_input NOT IN (
    'tenderflow.contacts.read',
    'tenderflow.write',
    'tenderflow.bids.offer.write'
  ) THEN
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
    next_expiry := CASE
      WHEN permission_input = 'tenderflow.contacts.read' THEN NOW() + INTERVAL '30 days'
      WHEN permission_input IN ('tenderflow.write', 'tenderflow.bids.offer.write')
        THEN 'infinity'::TIMESTAMPTZ
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

REVOKE ALL ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.change_mcp_bid_offer(
  bid_id_input TEXT,
  price_excluding_vat_input NUMERIC,
  notes_appendix_input TEXT DEFAULT NULL,
  selection_round_input INTEGER DEFAULT NULL,
  expected_updated_at_input TEXT DEFAULT NULL,
  dry_run_input BOOLEAN DEFAULT false
)
RETURNS TABLE (
  bid_id TEXT,
  project_id TEXT,
  tender_id TEXT,
  previous_price NUMERIC,
  price NUMERIC,
  previous_notes TEXT,
  notes TEXT,
  selection_round INTEGER,
  expected_updated_at TEXT,
  changed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := public.mcp_current_user_id();
  normalized_bid_id TEXT := BTRIM(COALESCE(bid_id_input, ''));
  normalized_appendix TEXT := NULLIF(BTRIM(COALESCE(notes_appendix_input, '')), '');
  resolved_project_id TEXT;
  resolved_tender_id TEXT;
  current_price NUMERIC;
  current_notes TEXT;
  current_selection_round INTEGER;
  current_updated_at TEXT;
  resolved_selection_round INTEGER;
  combined_notes TEXT;
  formatted_price TEXT;
  will_change BOOLEAN;
BEGIN
  IF caller_id IS NULL
    OR public.mcp_current_client_id() IS NULL
    OR NOT public.mcp_has_permission('tenderflow.write')
    OR NOT public.mcp_has_permission('tenderflow.bids.offer.write')
  THEN
    RAISE EXCEPTION 'Not authorized to change bid offer.' USING ERRCODE = '42501';
  END IF;

  IF normalized_bid_id = ''
    OR CHAR_LENGTH(normalized_bid_id) > 100
    OR price_excluding_vat_input IS NULL
    OR price_excluding_vat_input <= 0
    OR price_excluding_vat_input > 1000000000000
    OR ROUND(price_excluding_vat_input, 2) IS DISTINCT FROM price_excluding_vat_input
    OR CHAR_LENGTH(COALESCE(normalized_appendix, '')) > 5000
    OR (selection_round_input IS NOT NULL AND selection_round_input NOT IN (0, 1, 2, 3))
  THEN
    RAISE EXCEPTION 'Invalid bid offer update input.' USING ERRCODE = '22023';
  END IF;

  SELECT
    category.id::TEXT,
    category.project_id::TEXT,
    bid.price,
    bid.notes,
    bid.selection_round,
    bid.updated_at::TEXT
  INTO
    resolved_tender_id,
    resolved_project_id,
    current_price,
    current_notes,
    current_selection_round,
    current_updated_at
  FROM public.bids AS bid
  JOIN public.demand_categories AS category
    ON category.id::TEXT = bid.demand_category_id::TEXT
  WHERE bid.id::TEXT = normalized_bid_id
  FOR UPDATE OF bid;

  IF resolved_project_id IS NULL
    OR NOT public.can_project_module_action(resolved_project_id, 'module_pipeline', true)
  THEN
    RAISE EXCEPTION 'Bid is not writable by the authenticated user.' USING ERRCODE = '42501';
  END IF;

  IF expected_updated_at_input IS NOT NULL
    AND current_updated_at IS DISTINCT FROM expected_updated_at_input
  THEN
    RAISE EXCEPTION 'Bid changed after the proposal was prepared.' USING ERRCODE = '40001';
  END IF;

  resolved_selection_round := COALESCE(selection_round_input, current_selection_round, 1);
  combined_notes := CASE
    WHEN normalized_appendix IS NULL THEN current_notes
    WHEN BTRIM(COALESCE(current_notes, '')) = normalized_appendix THEN current_notes
    WHEN RIGHT(COALESCE(current_notes, ''), CHAR_LENGTH(E'\n\n' || normalized_appendix))
      = E'\n\n' || normalized_appendix THEN current_notes
    WHEN NULLIF(BTRIM(COALESCE(current_notes, '')), '') IS NULL THEN normalized_appendix
    ELSE current_notes || E'\n\n' || normalized_appendix
  END;

  IF CHAR_LENGTH(combined_notes) > 10000 THEN
    RAISE EXCEPTION 'Combined bid notes exceed 10000 characters.' USING ERRCODE = '22001';
  END IF;

  formatted_price := REGEXP_REPLACE(
    TO_CHAR(price_excluding_vat_input, 'FM9999999999999990D00'),
    '([.,]00)$',
    ''
  ) || ' Kč';
  will_change := current_price IS DISTINCT FROM price_excluding_vat_input
    OR current_notes IS DISTINCT FROM combined_notes
    OR current_selection_round IS DISTINCT FROM resolved_selection_round;

  IF dry_run_input THEN
    RETURN QUERY SELECT
      normalized_bid_id,
      resolved_project_id,
      resolved_tender_id,
      current_price,
      price_excluding_vat_input,
      current_notes,
      combined_notes,
      resolved_selection_round,
      current_updated_at,
      false;
    RETURN;
  END IF;

  IF will_change THEN
    UPDATE public.bids AS bid
    SET price = price_excluding_vat_input,
        price_display = formatted_price,
        price_history = jsonb_set(
          COALESCE(bid.price_history, '{}'::JSONB),
          ARRAY[resolved_selection_round::TEXT],
          TO_JSONB(formatted_price),
          true
        ),
        notes = combined_notes,
        selection_round = resolved_selection_round,
        updated_at = NOW()
    WHERE bid.id::TEXT = normalized_bid_id;
  END IF;

  RETURN QUERY SELECT
    normalized_bid_id,
    resolved_project_id,
    resolved_tender_id,
    current_price,
    price_excluding_vat_input,
    current_notes,
    combined_notes,
    resolved_selection_round,
    current_updated_at,
    will_change;
END;
$$;

REVOKE ALL ON FUNCTION public.change_mcp_bid_offer(
  TEXT, NUMERIC, TEXT, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_mcp_bid_offer(
  TEXT, NUMERIC, TEXT, INTEGER, TEXT, BOOLEAN
) TO tenderflow_mcp_client;

COMMENT ON FUNCTION public.change_mcp_bid_offer(
  TEXT, NUMERIC, TEXT, INTEGER, TEXT, BOOLEAN
) IS 'Previews or performs one authorized MCP total bid price excluding VAT update and append-only note addition with optimistic concurrency control.';

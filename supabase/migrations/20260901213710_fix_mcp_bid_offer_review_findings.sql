-- Repair the financial MCP permission boundary and make bid revisions
-- authoritative for every write path, including the regular application UI.

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
      'tenderflow.write',
      'tenderflow.bids.offer.write'
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

CREATE OR REPLACE FUNCTION public.set_bid_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_bid_updated_at()
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;

DROP TRIGGER IF EXISTS bids_set_updated_at ON public.bids;
CREATE TRIGGER bids_set_updated_at
BEFORE UPDATE ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.set_bid_updated_at();

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
  current_price_display TEXT;
  current_price_history JSONB;
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
    bid.price_display,
    bid.price_history,
    bid.notes,
    bid.selection_round,
    bid.updated_at::TEXT
  INTO
    resolved_tender_id,
    resolved_project_id,
    current_price,
    current_price_display,
    current_price_history,
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
    OR current_price_display IS DISTINCT FROM formatted_price
    OR (current_price_history ->> resolved_selection_round::TEXT) IS DISTINCT FROM formatted_price
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
          CASE
            WHEN jsonb_typeof(bid.price_history) = 'object' THEN bid.price_history
            ELSE '{}'::JSONB
          END,
          ARRAY[resolved_selection_round::TEXT],
          TO_JSONB(formatted_price),
          true
        ),
        notes = combined_notes,
        selection_round = resolved_selection_round
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

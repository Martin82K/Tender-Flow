-- A status-only MCP write boundary for supplier bids. The MCP database role
-- keeps SELECT-only table access; this RPC is the sole authorized mutation.

-- Production already uses `contacted`; keep fresh databases aligned with the
-- authoritative six-value status domain before exposing that value via MCP.
ALTER TABLE public.bids
  DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE public.bids
  ADD CONSTRAINT bids_status_check
  CHECK (status IN (
    'contacted',
    'sent',
    'offer',
    'shortlist',
    'sod',
    'rejected'
  )) NOT VALID;
ALTER TABLE public.bids
  VALIDATE CONSTRAINT bids_status_check;

CREATE OR REPLACE FUNCTION public.change_mcp_bid_status(
  bid_id_input TEXT,
  status_input TEXT,
  expected_status_input TEXT DEFAULT NULL,
  dry_run_input BOOLEAN DEFAULT false
)
RETURNS TABLE (
  bid_id TEXT,
  project_id TEXT,
  tender_id TEXT,
  previous_status TEXT,
  status TEXT,
  changed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := public.mcp_current_user_id();
  normalized_bid_id TEXT := BTRIM(COALESCE(bid_id_input, ''));
  normalized_status TEXT := BTRIM(COALESCE(status_input, ''));
  normalized_expected_status TEXT := NULLIF(BTRIM(COALESCE(expected_status_input, '')), '');
  resolved_project_id TEXT;
  resolved_tender_id TEXT;
  current_bid_status TEXT;
BEGIN
  IF caller_id IS NULL
    OR public.mcp_current_client_id() IS NULL
    OR NOT public.mcp_has_permission('tenderflow.write')
  THEN
    RAISE EXCEPTION 'Not authorized to change bid status.' USING ERRCODE = '42501';
  END IF;

  IF normalized_bid_id = ''
    OR CHAR_LENGTH(normalized_bid_id) > 100
    OR normalized_status NOT IN (
      'contacted',
      'sent',
      'offer',
      'shortlist',
      'sod',
      'rejected'
    )
    OR (
      normalized_expected_status IS NOT NULL
      AND normalized_expected_status NOT IN (
        'contacted',
        'sent',
        'offer',
        'shortlist',
        'sod',
        'rejected'
      )
    )
  THEN
    RAISE EXCEPTION 'Invalid bid status change input.' USING ERRCODE = '22023';
  END IF;

  SELECT
    category.id::TEXT,
    category.project_id::TEXT,
    bid.status::TEXT
  INTO resolved_tender_id, resolved_project_id, current_bid_status
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

  IF current_bid_status IS NULL
    OR current_bid_status NOT IN (
      'contacted',
      'sent',
      'offer',
      'shortlist',
      'sod',
      'rejected'
    )
  THEN
    RAISE EXCEPTION 'Bid has an unsupported current status.' USING ERRCODE = '22023';
  END IF;

  IF current_bid_status = normalized_status THEN
    RETURN QUERY SELECT
      normalized_bid_id,
      resolved_project_id,
      resolved_tender_id,
      current_bid_status,
      normalized_status,
      false;
    RETURN;
  END IF;

  IF normalized_expected_status IS NOT NULL
    AND current_bid_status IS DISTINCT FROM normalized_expected_status
  THEN
    RAISE EXCEPTION 'Bid status changed after the proposal was prepared.' USING ERRCODE = '40001';
  END IF;

  IF dry_run_input THEN
    RETURN QUERY SELECT
      normalized_bid_id,
      resolved_project_id,
      resolved_tender_id,
      current_bid_status,
      normalized_status,
      false;
    RETURN;
  END IF;

  UPDATE public.bids AS bid
  SET status = normalized_status,
      updated_at = NOW()
  WHERE bid.id::TEXT = normalized_bid_id;

  RETURN QUERY SELECT
    normalized_bid_id,
    resolved_project_id,
    resolved_tender_id,
    current_bid_status,
    normalized_status,
    true;
END;
$$;

REVOKE ALL ON FUNCTION public.change_mcp_bid_status(TEXT, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_mcp_bid_status(TEXT, TEXT, TEXT, BOOLEAN)
  TO tenderflow_mcp_client;

COMMENT ON FUNCTION public.change_mcp_bid_status(TEXT, TEXT, TEXT, BOOLEAN) IS
  'Previews or idempotently performs one authorized MCP bid status change without granting direct table UPDATE.';

-- =============================================================================
-- Fix: export_user_backup to include records with NULL owner_id (legacy data)
-- Records created before the organization migration have owner_id = NULL
-- =============================================================================

CREATE OR REPLACE FUNCTION public.export_user_backup(target_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  uid UUID := auth.uid();
  project_ids TEXT[];
  category_ids TEXT[];
  bid_ids TEXT[];
  contract_ids UUID[];
  rec_counts JSONB;
BEGIN
  -- Guard: must be org member
  IF NOT public.is_org_member(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Collect IDs for cascading queries
  -- Include records owned by user OR with NULL owner_id (legacy) in user's org
  SELECT ARRAY_AGG(p.id) INTO project_ids
  FROM public.projects p
  WHERE p.organization_id = target_org_id
    AND (p.owner_id = uid OR p.owner_id IS NULL);

  IF project_ids IS NULL THEN
    project_ids := ARRAY[]::TEXT[];
  END IF;

  SELECT ARRAY_AGG(dc.id) INTO category_ids
  FROM public.demand_categories dc
  WHERE dc.project_id = ANY(project_ids);

  IF category_ids IS NULL THEN
    category_ids := ARRAY[]::TEXT[];
  END IF;

  SELECT ARRAY_AGG(b.id) INTO bid_ids
  FROM public.bids b
  WHERE b.category_id = ANY(category_ids);

  IF bid_ids IS NULL THEN
    bid_ids := ARRAY[]::TEXT[];
  END IF;

  SELECT ARRAY_AGG(c.id) INTO contract_ids
  FROM public.contracts c
  WHERE c.organization_id = target_org_id
    AND (c.owner_id = uid OR c.owner_id IS NULL);

  IF contract_ids IS NULL THEN
    contract_ids := ARRAY[]::UUID[];
  END IF;

  -- Build the manifest
  result := jsonb_build_object(
    'version', '1.0',
    'type', 'user',
    'exported_at', NOW()::TEXT,
    'user_id', uid::TEXT,
    'organization_id', target_org_id::TEXT,

    'projects', COALESCE((
      SELECT jsonb_agg(row_to_json(p)::JSONB)
      FROM public.projects p
      WHERE p.organization_id = target_org_id
        AND (p.owner_id = uid OR p.owner_id IS NULL)
    ), '[]'::JSONB),

    'project_contracts', COALESCE((
      SELECT jsonb_agg(row_to_json(pc)::JSONB)
      FROM public.project_contracts pc
      WHERE pc.project_id = ANY(project_ids)
    ), '[]'::JSONB),

    'project_investor_financials', COALESCE((
      SELECT jsonb_agg(row_to_json(pif)::JSONB)
      FROM public.project_investor_financials pif
      WHERE pif.project_id = ANY(project_ids)
    ), '[]'::JSONB),

    'project_amendments', COALESCE((
      SELECT jsonb_agg(row_to_json(pa)::JSONB)
      FROM public.project_amendments pa
      WHERE pa.project_id = ANY(project_ids)
    ), '[]'::JSONB),

    'demand_categories', COALESCE((
      SELECT jsonb_agg(row_to_json(dc)::JSONB)
      FROM public.demand_categories dc
      WHERE dc.project_id = ANY(project_ids)
    ), '[]'::JSONB),

    'bids', COALESCE((
      SELECT jsonb_agg(row_to_json(b)::JSONB)
      FROM public.bids b
      WHERE b.category_id = ANY(category_ids)
    ), '[]'::JSONB),

    'bid_tags', COALESCE((
      SELECT jsonb_agg(row_to_json(bt)::JSONB)
      FROM public.bid_tags bt
      WHERE bt.bid_id = ANY(bid_ids)
    ), '[]'::JSONB),

    'subcontractors', COALESCE((
      SELECT jsonb_agg(row_to_json(s)::JSONB)
      FROM public.subcontractors s
      WHERE s.organization_id = target_org_id
        AND (s.owner_id = uid OR s.owner_id IS NULL)
    ), '[]'::JSONB),

    'subcontractor_statuses', COALESCE((
      SELECT jsonb_agg(row_to_json(ss)::JSONB)
      FROM public.subcontractor_statuses ss
      WHERE ss.organization_id = target_org_id
    ), '[]'::JSONB),

    'tender_plans', COALESCE((
      SELECT jsonb_agg(row_to_json(tp)::JSONB)
      FROM public.tender_plans tp
      WHERE tp.project_id = ANY(project_ids)
    ), '[]'::JSONB),

    'contracts', COALESCE((
      SELECT jsonb_agg(row_to_json(c)::JSONB)
      FROM public.contracts c
      WHERE c.organization_id = target_org_id
        AND (c.owner_id = uid OR c.owner_id IS NULL)
    ), '[]'::JSONB),

    'contract_amendments', COALESCE((
      SELECT jsonb_agg(row_to_json(ca)::JSONB)
      FROM public.contract_amendments ca
      WHERE ca.contract_id = ANY(contract_ids)
    ), '[]'::JSONB),

    'contract_drawdowns', COALESCE((
      SELECT jsonb_agg(row_to_json(cd)::JSONB)
      FROM public.contract_drawdowns cd
      WHERE cd.contract_id = ANY(contract_ids)
    ), '[]'::JSONB)
  );

  -- Record counts for history
  rec_counts := jsonb_build_object(
    'projects', jsonb_array_length(result->'projects'),
    'demand_categories', jsonb_array_length(result->'demand_categories'),
    'bids', jsonb_array_length(result->'bids'),
    'subcontractors', jsonb_array_length(result->'subcontractors'),
    'contracts', jsonb_array_length(result->'contracts'),
    'tender_plans', jsonb_array_length(result->'tender_plans')
  );

  -- Log to backup_history
  INSERT INTO public.backup_history (user_id, organization_id, backup_type, record_counts, backup_size_bytes)
  VALUES (uid, target_org_id, 'user', rec_counts, octet_length(result::TEXT));

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

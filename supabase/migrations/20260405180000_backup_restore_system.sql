-- =============================================================================
-- Backup & Restore System
-- Provides user-level and tenant-level backup/restore via RPC functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. backup_history table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('user', 'tenant')),
    storage_path TEXT,
    record_counts JSONB,
    backup_size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- User sees own backup history
CREATE POLICY "backup_history_select_own"
  ON public.backup_history FOR SELECT
  USING (user_id = auth.uid());

-- Org admin sees org backup history
CREATE POLICY "backup_history_select_org"
  ON public.backup_history FOR SELECT
  USING (public.is_org_member(organization_id));

-- User can insert own records
CREATE POLICY "backup_history_insert_own"
  ON public.backup_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. export_user_backup(target_org_id UUID)
-- Returns all data owned by current user within the given organization
-- -----------------------------------------------------------------------------
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
  -- Include projects owned by user OR with NULL owner_id (legacy) in user's org
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

-- -----------------------------------------------------------------------------
-- 3. export_tenant_backup(target_org_id UUID)
-- Returns ALL data within the organization (admin/owner only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_tenant_backup(target_org_id UUID)
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
  -- Guard: must be org admin or owner
  IF NOT public.is_org_admin(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: organization admin role required';
  END IF;

  -- Collect all org project IDs
  SELECT ARRAY_AGG(p.id) INTO project_ids
  FROM public.projects p
  WHERE p.organization_id = target_org_id;

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
  WHERE c.organization_id = target_org_id;

  IF contract_ids IS NULL THEN
    contract_ids := ARRAY[]::UUID[];
  END IF;

  -- Build the manifest
  result := jsonb_build_object(
    'version', '1.0',
    'type', 'tenant',
    'exported_at', NOW()::TEXT,
    'user_id', uid::TEXT,
    'organization_id', target_org_id::TEXT,

    'projects', COALESCE((
      SELECT jsonb_agg(row_to_json(p)::JSONB)
      FROM public.projects p
      WHERE p.organization_id = target_org_id
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

  -- Record counts
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
  VALUES (uid, target_org_id, 'tenant', rec_counts, octet_length(result::TEXT));

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 4. restore_user_backup(backup_json JSONB, target_org_id UUID)
-- Restores user-owned data only. Uses INSERT ... ON CONFLICT DO UPDATE
-- with owner_id guard. Entire operation is transactional.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_user_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB AS $$
DECLARE
  uid UUID := auth.uid();
  manifest_version TEXT;
  item JSONB;
  cnt_projects INT := 0;
  cnt_categories INT := 0;
  cnt_bids INT := 0;
  cnt_bid_tags INT := 0;
  cnt_subcontractors INT := 0;
  cnt_statuses INT := 0;
  cnt_tender_plans INT := 0;
  cnt_contracts INT := 0;
  cnt_contract_amendments INT := 0;
  cnt_contract_drawdowns INT := 0;
  cnt_project_contracts INT := 0;
  cnt_project_financials INT := 0;
  cnt_project_amendments INT := 0;
BEGIN
  -- Guard: must be org member
  IF NOT public.is_org_member(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Validate manifest version
  manifest_version := backup_json->>'version';
  IF manifest_version IS NULL OR manifest_version != '1.0' THEN
    RAISE EXCEPTION 'Unsupported backup version: %', COALESCE(manifest_version, 'null');
  END IF;

  -- Size guard (50 MB)
  IF octet_length(backup_json::TEXT) > 52428800 THEN
    RAISE EXCEPTION 'Backup payload exceeds 50 MB limit';
  END IF;

  -- 1. Restore subcontractor_statuses
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'subcontractor_statuses', '[]'::JSONB))
  LOOP
    INSERT INTO public.subcontractor_statuses (id, label, color, sort_order, organization_id)
    VALUES (
      item->>'id',
      item->>'label',
      item->>'color',
      COALESCE((item->>'sort_order')::INT, 0),
      target_org_id
    )
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order
    WHERE subcontractor_statuses.organization_id = target_org_id;
    cnt_statuses := cnt_statuses + 1;
  END LOOP;

  -- 2. Restore subcontractors (only user-owned)
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'subcontractors', '[]'::JSONB))
  LOOP
    INSERT INTO public.subcontractors (
      id, company_name, contact_person_name, specialization, phone, email,
      ico, region, status_id, created_at, updated_at, owner_id, organization_id,
      contacts, address
    ) VALUES (
      item->>'id',
      item->>'company_name',
      item->>'contact_person_name',
      CASE WHEN item->'specialization' IS NOT NULL AND jsonb_typeof(item->'specialization') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(item->'specialization'))
        ELSE NULL
      END,
      item->>'phone',
      item->>'email',
      item->>'ico',
      item->>'region',
      item->>'status_id',
      COALESCE((item->>'created_at')::TIMESTAMP, NOW()),
      NOW(),
      uid,
      target_org_id,
      COALESCE(item->'contacts', '[]'::JSONB),
      item->>'address'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      contact_person_name = EXCLUDED.contact_person_name,
      specialization = EXCLUDED.specialization,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      ico = EXCLUDED.ico,
      region = EXCLUDED.region,
      status_id = EXCLUDED.status_id,
      updated_at = NOW(),
      contacts = EXCLUDED.contacts,
      address = EXCLUDED.address
    WHERE subcontractors.owner_id = uid;
    cnt_subcontractors := cnt_subcontractors + 1;
  END LOOP;

  -- 3. Restore projects (only user-owned)
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'projects', '[]'::JSONB))
  LOOP
    INSERT INTO public.projects (
      id, name, location, status, investor, technical_supervisor, finish_date,
      site_manager, construction_manager, construction_technician, planned_cost,
      created_at, updated_at, owner_id, organization_id, is_demo,
      dochub_provider, dochub_mode, dochub_root_id, dochub_root_name,
      dochub_drive_id, dochub_site_id, dochub_root_web_url, dochub_status,
      dochub_last_error, dochub_enabled, dochub_root_link,
      dochub_structure_version, dochub_structure_v1,
      dochub_autocreate_enabled, dochub_autocreate_last_run_at,
      dochub_autocreate_last_error, dochub_settings,
      losers_email_template_link, material_inquiry_template_link,
      document_links, archived_original_status
    ) VALUES (
      item->>'id',
      item->>'name',
      item->>'location',
      item->>'status',
      item->>'investor',
      item->>'technical_supervisor',
      item->>'finish_date',
      item->>'site_manager',
      item->>'construction_manager',
      item->>'construction_technician',
      (item->>'planned_cost')::DECIMAL,
      COALESCE((item->>'created_at')::TIMESTAMP, NOW()),
      NOW(),
      uid,
      target_org_id,
      COALESCE((item->>'is_demo')::BOOLEAN, false),
      item->>'dochub_provider',
      item->>'dochub_mode',
      item->>'dochub_root_id',
      item->>'dochub_root_name',
      item->>'dochub_drive_id',
      item->>'dochub_site_id',
      item->>'dochub_root_web_url',
      COALESCE(item->>'dochub_status', 'disconnected'),
      item->>'dochub_last_error',
      COALESCE((item->>'dochub_enabled')::BOOLEAN, false),
      item->>'dochub_root_link',
      COALESCE((item->>'dochub_structure_version')::INT, 1),
      item->'dochub_structure_v1',
      COALESCE((item->>'dochub_autocreate_enabled')::BOOLEAN, false),
      (item->>'dochub_autocreate_last_run_at')::TIMESTAMPTZ,
      item->>'dochub_autocreate_last_error',
      COALESCE(item->'dochub_settings', '{}'::JSONB),
      item->>'losers_email_template_link',
      item->>'material_inquiry_template_link',
      COALESCE(item->'document_links', '[]'::JSONB),
      item->>'archived_original_status'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      location = EXCLUDED.location,
      status = EXCLUDED.status,
      investor = EXCLUDED.investor,
      technical_supervisor = EXCLUDED.technical_supervisor,
      finish_date = EXCLUDED.finish_date,
      site_manager = EXCLUDED.site_manager,
      construction_manager = EXCLUDED.construction_manager,
      construction_technician = EXCLUDED.construction_technician,
      planned_cost = EXCLUDED.planned_cost,
      updated_at = NOW(),
      dochub_provider = EXCLUDED.dochub_provider,
      dochub_mode = EXCLUDED.dochub_mode,
      dochub_root_id = EXCLUDED.dochub_root_id,
      dochub_root_name = EXCLUDED.dochub_root_name,
      dochub_drive_id = EXCLUDED.dochub_drive_id,
      dochub_site_id = EXCLUDED.dochub_site_id,
      dochub_root_web_url = EXCLUDED.dochub_root_web_url,
      dochub_status = EXCLUDED.dochub_status,
      dochub_last_error = EXCLUDED.dochub_last_error,
      dochub_enabled = EXCLUDED.dochub_enabled,
      dochub_root_link = EXCLUDED.dochub_root_link,
      dochub_structure_version = EXCLUDED.dochub_structure_version,
      dochub_structure_v1 = EXCLUDED.dochub_structure_v1,
      dochub_autocreate_enabled = EXCLUDED.dochub_autocreate_enabled,
      dochub_autocreate_last_run_at = EXCLUDED.dochub_autocreate_last_run_at,
      dochub_autocreate_last_error = EXCLUDED.dochub_autocreate_last_error,
      dochub_settings = EXCLUDED.dochub_settings,
      losers_email_template_link = EXCLUDED.losers_email_template_link,
      material_inquiry_template_link = EXCLUDED.material_inquiry_template_link,
      document_links = EXCLUDED.document_links,
      archived_original_status = EXCLUDED.archived_original_status
    WHERE projects.owner_id = uid;
    cnt_projects := cnt_projects + 1;
  END LOOP;

  -- 4. Restore project_contracts
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_contracts', '[]'::JSONB))
  LOOP
    -- Only insert if project is owned by current user
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND owner_id = uid) THEN
      INSERT INTO public.project_contracts (
        project_id, maturity_days, warranty_months, retention_terms,
        site_facilities_percent, insurance_percent
      ) VALUES (
        item->>'project_id',
        (item->>'maturity_days')::INT,
        (item->>'warranty_months')::INT,
        item->>'retention_terms',
        (item->>'site_facilities_percent')::DECIMAL,
        (item->>'insurance_percent')::DECIMAL
      )
      ON CONFLICT (project_id) DO UPDATE SET
        maturity_days = EXCLUDED.maturity_days,
        warranty_months = EXCLUDED.warranty_months,
        retention_terms = EXCLUDED.retention_terms,
        site_facilities_percent = EXCLUDED.site_facilities_percent,
        insurance_percent = EXCLUDED.insurance_percent;
      cnt_project_contracts := cnt_project_contracts + 1;
    END IF;
  END LOOP;

  -- 5. Restore project_investor_financials
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_investor_financials', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND owner_id = uid) THEN
      INSERT INTO public.project_investor_financials (project_id, sod_price)
      VALUES (item->>'project_id', (item->>'sod_price')::DECIMAL)
      ON CONFLICT (project_id) DO UPDATE SET sod_price = EXCLUDED.sod_price;
      cnt_project_financials := cnt_project_financials + 1;
    END IF;
  END LOOP;

  -- 6. Restore project_amendments
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_amendments', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND owner_id = uid) THEN
      INSERT INTO public.project_amendments (id, project_id, label, price, created_at)
      VALUES (
        item->>'id',
        item->>'project_id',
        item->>'label',
        (item->>'price')::DECIMAL,
        COALESCE((item->>'created_at')::TIMESTAMP, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        price = EXCLUDED.price;
      cnt_project_amendments := cnt_project_amendments + 1;
    END IF;
  END LOOP;

  -- 7. Restore demand_categories
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'demand_categories', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND owner_id = uid) THEN
      INSERT INTO public.demand_categories (
        id, project_id, title, budget_display, sod_budget, plan_budget,
        status, description, created_at, updated_at, deadline,
        realization_start, realization_end, work_items
      ) VALUES (
        item->>'id',
        item->>'project_id',
        item->>'title',
        item->>'budget_display',
        (item->>'sod_budget')::DECIMAL,
        (item->>'plan_budget')::DECIMAL,
        item->>'status',
        item->>'description',
        COALESCE((item->>'created_at')::TIMESTAMP, NOW()),
        NOW(),
        (item->>'deadline')::DATE,
        (item->>'realization_start')::DATE,
        (item->>'realization_end')::DATE,
        CASE WHEN item->'work_items' IS NOT NULL AND jsonb_typeof(item->'work_items') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(item->'work_items'))
          ELSE NULL
        END
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        budget_display = EXCLUDED.budget_display,
        sod_budget = EXCLUDED.sod_budget,
        plan_budget = EXCLUDED.plan_budget,
        status = EXCLUDED.status,
        description = EXCLUDED.description,
        updated_at = NOW(),
        deadline = EXCLUDED.deadline,
        realization_start = EXCLUDED.realization_start,
        realization_end = EXCLUDED.realization_end,
        work_items = EXCLUDED.work_items;
      cnt_categories := cnt_categories + 1;
    END IF;
  END LOOP;

  -- 8. Restore bids
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'bids', '[]'::JSONB))
  LOOP
    -- Check that the parent category belongs to user's project
    IF EXISTS (
      SELECT 1 FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id = item->>'category_id' AND p.owner_id = uid
    ) THEN
      INSERT INTO public.bids (
        id, category_id, subcontractor_id, price, price_display, notes,
        status, created_at, updated_at, update_date, selection_round,
        price_history, contracted
      ) VALUES (
        item->>'id',
        item->>'category_id',
        item->>'subcontractor_id',
        (item->>'price')::DECIMAL,
        item->>'price_display',
        item->>'notes',
        item->>'status',
        COALESCE((item->>'created_at')::TIMESTAMP, NOW()),
        NOW(),
        (item->>'update_date')::DATE,
        (item->>'selection_round')::INT,
        item->'price_history',
        COALESCE((item->>'contracted')::BOOLEAN, false)
      )
      ON CONFLICT (id) DO UPDATE SET
        price = EXCLUDED.price,
        price_display = EXCLUDED.price_display,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        updated_at = NOW(),
        update_date = EXCLUDED.update_date,
        selection_round = EXCLUDED.selection_round,
        price_history = EXCLUDED.price_history,
        contracted = EXCLUDED.contracted;
      cnt_bids := cnt_bids + 1;
    END IF;
  END LOOP;

  -- 9. Restore bid_tags
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'bid_tags', '[]'::JSONB))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.bids b
      JOIN public.demand_categories dc ON dc.id = b.category_id
      JOIN public.projects p ON p.id = dc.project_id
      WHERE b.id = item->>'bid_id' AND p.owner_id = uid
    ) THEN
      INSERT INTO public.bid_tags (bid_id, tag)
      VALUES (item->>'bid_id', item->>'tag')
      ON CONFLICT (bid_id, tag) DO NOTHING;
      cnt_bid_tags := cnt_bid_tags + 1;
    END IF;
  END LOOP;

  -- 10. Restore tender_plans
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'tender_plans', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND owner_id = uid) THEN
      INSERT INTO public.tender_plans (
        id, project_id, name, date_from, date_to, category_id,
        created_at, updated_at
      ) VALUES (
        item->>'id',
        item->>'project_id',
        item->>'name',
        (item->>'date_from')::DATE,
        (item->>'date_to')::DATE,
        item->>'category_id',
        COALESCE((item->>'created_at')::TIMESTAMP, NOW()),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        date_from = EXCLUDED.date_from,
        date_to = EXCLUDED.date_to,
        category_id = EXCLUDED.category_id,
        updated_at = NOW();
      cnt_tender_plans := cnt_tender_plans + 1;
    END IF;
  END LOOP;

  -- 11. Restore contracts (only user-owned)
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contracts', '[]'::JSONB))
  LOOP
    INSERT INTO public.contracts (
      id, project_id, vendor_id, vendor_name, title, contract_number,
      status, signed_at, effective_from, effective_to, currency,
      base_price, retention_percent, retention_amount, warranty_months,
      payment_terms, scope_summary, source, source_bid_id,
      document_url, extraction_confidence, extraction_json,
      owner_id, organization_id, created_by, created_at, updated_at,
      vendor_rating, vendor_rating_note, vendor_rating_at, vendor_rating_by,
      site_setup_percent, vendor_ico
    ) VALUES (
      (item->>'id')::UUID,
      item->>'project_id',
      item->>'vendor_id',
      COALESCE(item->>'vendor_name', ''),
      COALESCE(item->>'title', ''),
      item->>'contract_number',
      COALESCE(item->>'status', 'draft'),
      (item->>'signed_at')::DATE,
      (item->>'effective_from')::DATE,
      (item->>'effective_to')::DATE,
      COALESCE(item->>'currency', 'CZK'),
      COALESCE((item->>'base_price')::NUMERIC, 0),
      (item->>'retention_percent')::NUMERIC,
      (item->>'retention_amount')::NUMERIC,
      (item->>'warranty_months')::INT,
      item->>'payment_terms',
      item->>'scope_summary',
      COALESCE(item->>'source', 'manual'),
      item->>'source_bid_id',
      item->>'document_url',
      (item->>'extraction_confidence')::NUMERIC,
      item->'extraction_json',
      uid,
      target_org_id,
      uid,
      COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()),
      NOW(),
      (item->>'vendor_rating')::NUMERIC,
      item->>'vendor_rating_note',
      (item->>'vendor_rating_at')::TIMESTAMPTZ,
      (item->>'vendor_rating_by')::UUID,
      (item->>'site_setup_percent')::NUMERIC,
      item->>'vendor_ico'
    )
    ON CONFLICT (id) DO UPDATE SET
      vendor_name = EXCLUDED.vendor_name,
      title = EXCLUDED.title,
      contract_number = EXCLUDED.contract_number,
      status = EXCLUDED.status,
      signed_at = EXCLUDED.signed_at,
      effective_from = EXCLUDED.effective_from,
      effective_to = EXCLUDED.effective_to,
      base_price = EXCLUDED.base_price,
      retention_percent = EXCLUDED.retention_percent,
      retention_amount = EXCLUDED.retention_amount,
      warranty_months = EXCLUDED.warranty_months,
      payment_terms = EXCLUDED.payment_terms,
      scope_summary = EXCLUDED.scope_summary,
      document_url = EXCLUDED.document_url,
      updated_at = NOW(),
      vendor_rating = EXCLUDED.vendor_rating,
      vendor_rating_note = EXCLUDED.vendor_rating_note,
      vendor_rating_at = EXCLUDED.vendor_rating_at,
      site_setup_percent = EXCLUDED.site_setup_percent,
      vendor_ico = EXCLUDED.vendor_ico
    WHERE contracts.owner_id = uid;
    cnt_contracts := cnt_contracts + 1;
  END LOOP;

  -- 12. Restore contract_amendments
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contract_amendments', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.contracts WHERE id = (item->>'contract_id')::UUID AND owner_id = uid) THEN
      INSERT INTO public.contract_amendments (
        id, contract_id, amendment_no, signed_at, effective_from,
        delta_price, delta_deadline, reason, document_url,
        extraction_json, extraction_confidence, created_by, created_at, updated_at
      ) VALUES (
        (item->>'id')::UUID,
        (item->>'contract_id')::UUID,
        (item->>'amendment_no')::INT,
        (item->>'signed_at')::DATE,
        (item->>'effective_from')::DATE,
        COALESCE((item->>'delta_price')::NUMERIC, 0),
        (item->>'delta_deadline')::DATE,
        item->>'reason',
        item->>'document_url',
        item->'extraction_json',
        (item->>'extraction_confidence')::NUMERIC,
        uid,
        COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        amendment_no = EXCLUDED.amendment_no,
        signed_at = EXCLUDED.signed_at,
        effective_from = EXCLUDED.effective_from,
        delta_price = EXCLUDED.delta_price,
        delta_deadline = EXCLUDED.delta_deadline,
        reason = EXCLUDED.reason,
        document_url = EXCLUDED.document_url,
        updated_at = NOW();
      cnt_contract_amendments := cnt_contract_amendments + 1;
    END IF;
  END LOOP;

  -- 13. Restore contract_drawdowns
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contract_drawdowns', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.contracts WHERE id = (item->>'contract_id')::UUID AND owner_id = uid) THEN
      INSERT INTO public.contract_drawdowns (
        id, contract_id, period, claimed_amount, approved_amount,
        note, document_url, extraction_json, extraction_confidence,
        created_by, created_at, updated_at
      ) VALUES (
        (item->>'id')::UUID,
        (item->>'contract_id')::UUID,
        item->>'period',
        COALESCE((item->>'claimed_amount')::NUMERIC, 0),
        COALESCE((item->>'approved_amount')::NUMERIC, 0),
        item->>'note',
        item->>'document_url',
        item->'extraction_json',
        (item->>'extraction_confidence')::NUMERIC,
        uid,
        COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        period = EXCLUDED.period,
        claimed_amount = EXCLUDED.claimed_amount,
        approved_amount = EXCLUDED.approved_amount,
        note = EXCLUDED.note,
        document_url = EXCLUDED.document_url,
        updated_at = NOW();
      cnt_contract_drawdowns := cnt_contract_drawdowns + 1;
    END IF;
  END LOOP;

  -- Log restore to history
  INSERT INTO public.backup_history (user_id, organization_id, backup_type, record_counts)
  VALUES (uid, target_org_id, 'user', jsonb_build_object(
    'operation', 'restore',
    'projects', cnt_projects,
    'demand_categories', cnt_categories,
    'bids', cnt_bids,
    'bid_tags', cnt_bid_tags,
    'subcontractors', cnt_subcontractors,
    'subcontractor_statuses', cnt_statuses,
    'tender_plans', cnt_tender_plans,
    'contracts', cnt_contracts,
    'contract_amendments', cnt_contract_amendments,
    'contract_drawdowns', cnt_contract_drawdowns,
    'project_contracts', cnt_project_contracts,
    'project_investor_financials', cnt_project_financials,
    'project_amendments', cnt_project_amendments
  ));

  RETURN jsonb_build_object(
    'success', true,
    'restored_projects', cnt_projects,
    'restored_demand_categories', cnt_categories,
    'restored_bids', cnt_bids,
    'restored_bid_tags', cnt_bid_tags,
    'restored_subcontractors', cnt_subcontractors,
    'restored_subcontractor_statuses', cnt_statuses,
    'restored_tender_plans', cnt_tender_plans,
    'restored_contracts', cnt_contracts,
    'restored_contract_amendments', cnt_contract_amendments,
    'restored_contract_drawdowns', cnt_contract_drawdowns,
    'restored_project_contracts', cnt_project_contracts,
    'restored_project_investor_financials', cnt_project_financials,
    'restored_project_amendments', cnt_project_amendments
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5. restore_tenant_backup(backup_json JSONB, target_org_id UUID)
-- Restores all org data. Preserves original owner_id from backup.
-- Admin/owner only. Transactional.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_tenant_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB AS $$
DECLARE
  uid UUID := auth.uid();
  manifest_version TEXT;
  item JSONB;
  item_owner UUID;
  cnt_projects INT := 0;
  cnt_categories INT := 0;
  cnt_bids INT := 0;
  cnt_bid_tags INT := 0;
  cnt_subcontractors INT := 0;
  cnt_statuses INT := 0;
  cnt_tender_plans INT := 0;
  cnt_contracts INT := 0;
  cnt_contract_amendments INT := 0;
  cnt_contract_drawdowns INT := 0;
  cnt_project_contracts INT := 0;
  cnt_project_financials INT := 0;
  cnt_project_amendments INT := 0;
BEGIN
  -- Guard: must be org admin or owner
  IF NOT public.is_org_admin(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: organization admin role required';
  END IF;

  -- Validate manifest
  manifest_version := backup_json->>'version';
  IF manifest_version IS NULL OR manifest_version != '1.0' THEN
    RAISE EXCEPTION 'Unsupported backup version: %', COALESCE(manifest_version, 'null');
  END IF;

  IF octet_length(backup_json::TEXT) > 52428800 THEN
    RAISE EXCEPTION 'Backup payload exceeds 50 MB limit';
  END IF;

  -- 1. Restore subcontractor_statuses
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'subcontractor_statuses', '[]'::JSONB))
  LOOP
    INSERT INTO public.subcontractor_statuses (id, label, color, sort_order, organization_id)
    VALUES (
      item->>'id', item->>'label', item->>'color',
      COALESCE((item->>'sort_order')::INT, 0), target_org_id
    )
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order
    WHERE subcontractor_statuses.organization_id = target_org_id;
    cnt_statuses := cnt_statuses + 1;
  END LOOP;

  -- 2. Restore subcontractors (preserve original owner_id)
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'subcontractors', '[]'::JSONB))
  LOOP
    item_owner := NULLIF(item->>'owner_id', '')::UUID;
    INSERT INTO public.subcontractors (
      id, company_name, contact_person_name, specialization, phone, email,
      ico, region, status_id, created_at, updated_at, owner_id, organization_id,
      contacts, address
    ) VALUES (
      item->>'id', item->>'company_name', item->>'contact_person_name',
      CASE WHEN item->'specialization' IS NOT NULL AND jsonb_typeof(item->'specialization') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(item->'specialization')) ELSE NULL END,
      item->>'phone', item->>'email', item->>'ico', item->>'region',
      item->>'status_id', COALESCE((item->>'created_at')::TIMESTAMP, NOW()), NOW(),
      COALESCE(item_owner, uid), target_org_id,
      COALESCE(item->'contacts', '[]'::JSONB), item->>'address'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name, contact_person_name = EXCLUDED.contact_person_name,
      specialization = EXCLUDED.specialization, phone = EXCLUDED.phone, email = EXCLUDED.email,
      ico = EXCLUDED.ico, region = EXCLUDED.region, status_id = EXCLUDED.status_id,
      updated_at = NOW(), contacts = EXCLUDED.contacts, address = EXCLUDED.address
    WHERE subcontractors.organization_id = target_org_id;
    cnt_subcontractors := cnt_subcontractors + 1;
  END LOOP;

  -- 3. Restore projects (preserve original owner_id)
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'projects', '[]'::JSONB))
  LOOP
    item_owner := NULLIF(item->>'owner_id', '')::UUID;
    INSERT INTO public.projects (
      id, name, location, status, investor, technical_supervisor, finish_date,
      site_manager, construction_manager, construction_technician, planned_cost,
      created_at, updated_at, owner_id, organization_id, is_demo,
      dochub_provider, dochub_mode, dochub_root_id, dochub_root_name,
      dochub_drive_id, dochub_site_id, dochub_root_web_url, dochub_status,
      dochub_last_error, dochub_enabled, dochub_root_link,
      dochub_structure_version, dochub_structure_v1,
      dochub_autocreate_enabled, dochub_autocreate_last_run_at,
      dochub_autocreate_last_error, dochub_settings,
      losers_email_template_link, material_inquiry_template_link,
      document_links, archived_original_status
    ) VALUES (
      item->>'id', item->>'name', item->>'location', item->>'status',
      item->>'investor', item->>'technical_supervisor', item->>'finish_date',
      item->>'site_manager', item->>'construction_manager', item->>'construction_technician',
      (item->>'planned_cost')::DECIMAL, COALESCE((item->>'created_at')::TIMESTAMP, NOW()), NOW(),
      COALESCE(item_owner, uid), target_org_id,
      COALESCE((item->>'is_demo')::BOOLEAN, false),
      item->>'dochub_provider', item->>'dochub_mode', item->>'dochub_root_id',
      item->>'dochub_root_name', item->>'dochub_drive_id', item->>'dochub_site_id',
      item->>'dochub_root_web_url', COALESCE(item->>'dochub_status', 'disconnected'),
      item->>'dochub_last_error', COALESCE((item->>'dochub_enabled')::BOOLEAN, false),
      item->>'dochub_root_link', COALESCE((item->>'dochub_structure_version')::INT, 1),
      item->'dochub_structure_v1', COALESCE((item->>'dochub_autocreate_enabled')::BOOLEAN, false),
      (item->>'dochub_autocreate_last_run_at')::TIMESTAMPTZ,
      item->>'dochub_autocreate_last_error', COALESCE(item->'dochub_settings', '{}'::JSONB),
      item->>'losers_email_template_link', item->>'material_inquiry_template_link',
      COALESCE(item->'document_links', '[]'::JSONB), item->>'archived_original_status'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, location = EXCLUDED.location, status = EXCLUDED.status,
      investor = EXCLUDED.investor, technical_supervisor = EXCLUDED.technical_supervisor,
      finish_date = EXCLUDED.finish_date, site_manager = EXCLUDED.site_manager,
      construction_manager = EXCLUDED.construction_manager, construction_technician = EXCLUDED.construction_technician,
      planned_cost = EXCLUDED.planned_cost, updated_at = NOW(),
      dochub_provider = EXCLUDED.dochub_provider, dochub_mode = EXCLUDED.dochub_mode,
      dochub_root_id = EXCLUDED.dochub_root_id, dochub_root_name = EXCLUDED.dochub_root_name,
      dochub_drive_id = EXCLUDED.dochub_drive_id, dochub_site_id = EXCLUDED.dochub_site_id,
      dochub_root_web_url = EXCLUDED.dochub_root_web_url, dochub_status = EXCLUDED.dochub_status,
      dochub_last_error = EXCLUDED.dochub_last_error, dochub_enabled = EXCLUDED.dochub_enabled,
      dochub_root_link = EXCLUDED.dochub_root_link, dochub_structure_version = EXCLUDED.dochub_structure_version,
      dochub_structure_v1 = EXCLUDED.dochub_structure_v1, dochub_autocreate_enabled = EXCLUDED.dochub_autocreate_enabled,
      dochub_autocreate_last_run_at = EXCLUDED.dochub_autocreate_last_run_at,
      dochub_autocreate_last_error = EXCLUDED.dochub_autocreate_last_error,
      dochub_settings = EXCLUDED.dochub_settings, losers_email_template_link = EXCLUDED.losers_email_template_link,
      material_inquiry_template_link = EXCLUDED.material_inquiry_template_link,
      document_links = EXCLUDED.document_links, archived_original_status = EXCLUDED.archived_original_status
    WHERE projects.organization_id = target_org_id;
    cnt_projects := cnt_projects + 1;
  END LOOP;

  -- 4-13: Child tables (same pattern as user restore but with org-level ownership check)

  -- 4. project_contracts
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_contracts', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND organization_id = target_org_id) THEN
      INSERT INTO public.project_contracts (project_id, maturity_days, warranty_months, retention_terms, site_facilities_percent, insurance_percent)
      VALUES (item->>'project_id', (item->>'maturity_days')::INT, (item->>'warranty_months')::INT, item->>'retention_terms', (item->>'site_facilities_percent')::DECIMAL, (item->>'insurance_percent')::DECIMAL)
      ON CONFLICT (project_id) DO UPDATE SET maturity_days = EXCLUDED.maturity_days, warranty_months = EXCLUDED.warranty_months, retention_terms = EXCLUDED.retention_terms, site_facilities_percent = EXCLUDED.site_facilities_percent, insurance_percent = EXCLUDED.insurance_percent;
      cnt_project_contracts := cnt_project_contracts + 1;
    END IF;
  END LOOP;

  -- 5. project_investor_financials
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_investor_financials', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND organization_id = target_org_id) THEN
      INSERT INTO public.project_investor_financials (project_id, sod_price)
      VALUES (item->>'project_id', (item->>'sod_price')::DECIMAL)
      ON CONFLICT (project_id) DO UPDATE SET sod_price = EXCLUDED.sod_price;
      cnt_project_financials := cnt_project_financials + 1;
    END IF;
  END LOOP;

  -- 6. project_amendments
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'project_amendments', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND organization_id = target_org_id) THEN
      INSERT INTO public.project_amendments (id, project_id, label, price, created_at)
      VALUES (item->>'id', item->>'project_id', item->>'label', (item->>'price')::DECIMAL, COALESCE((item->>'created_at')::TIMESTAMP, NOW()))
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, price = EXCLUDED.price;
      cnt_project_amendments := cnt_project_amendments + 1;
    END IF;
  END LOOP;

  -- 7. demand_categories
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'demand_categories', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND organization_id = target_org_id) THEN
      INSERT INTO public.demand_categories (id, project_id, title, budget_display, sod_budget, plan_budget, status, description, created_at, updated_at, deadline, realization_start, realization_end, work_items)
      VALUES (item->>'id', item->>'project_id', item->>'title', item->>'budget_display', (item->>'sod_budget')::DECIMAL, (item->>'plan_budget')::DECIMAL, item->>'status', item->>'description', COALESCE((item->>'created_at')::TIMESTAMP, NOW()), NOW(), (item->>'deadline')::DATE, (item->>'realization_start')::DATE, (item->>'realization_end')::DATE,
        CASE WHEN item->'work_items' IS NOT NULL AND jsonb_typeof(item->'work_items') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(item->'work_items')) ELSE NULL END)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, budget_display = EXCLUDED.budget_display, sod_budget = EXCLUDED.sod_budget, plan_budget = EXCLUDED.plan_budget, status = EXCLUDED.status, description = EXCLUDED.description, updated_at = NOW(), deadline = EXCLUDED.deadline, realization_start = EXCLUDED.realization_start, realization_end = EXCLUDED.realization_end, work_items = EXCLUDED.work_items;
      cnt_categories := cnt_categories + 1;
    END IF;
  END LOOP;

  -- 8. bids
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'bids', '[]'::JSONB))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.demand_categories dc JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id = item->>'category_id' AND p.organization_id = target_org_id
    ) THEN
      INSERT INTO public.bids (id, category_id, subcontractor_id, price, price_display, notes, status, created_at, updated_at, update_date, selection_round, price_history, contracted)
      VALUES (item->>'id', item->>'category_id', item->>'subcontractor_id', (item->>'price')::DECIMAL, item->>'price_display', item->>'notes', item->>'status', COALESCE((item->>'created_at')::TIMESTAMP, NOW()), NOW(), (item->>'update_date')::DATE, (item->>'selection_round')::INT, item->'price_history', COALESCE((item->>'contracted')::BOOLEAN, false))
      ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, price_display = EXCLUDED.price_display, notes = EXCLUDED.notes, status = EXCLUDED.status, updated_at = NOW(), update_date = EXCLUDED.update_date, selection_round = EXCLUDED.selection_round, price_history = EXCLUDED.price_history, contracted = EXCLUDED.contracted;
      cnt_bids := cnt_bids + 1;
    END IF;
  END LOOP;

  -- 9. bid_tags
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'bid_tags', '[]'::JSONB))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.bids b JOIN public.demand_categories dc ON dc.id = b.category_id JOIN public.projects p ON p.id = dc.project_id
      WHERE b.id = item->>'bid_id' AND p.organization_id = target_org_id
    ) THEN
      INSERT INTO public.bid_tags (bid_id, tag) VALUES (item->>'bid_id', item->>'tag')
      ON CONFLICT (bid_id, tag) DO NOTHING;
      cnt_bid_tags := cnt_bid_tags + 1;
    END IF;
  END LOOP;

  -- 10. tender_plans
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'tender_plans', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = item->>'project_id' AND organization_id = target_org_id) THEN
      INSERT INTO public.tender_plans (id, project_id, name, date_from, date_to, category_id, created_at, updated_at)
      VALUES (item->>'id', item->>'project_id', item->>'name', (item->>'date_from')::DATE, (item->>'date_to')::DATE, item->>'category_id', COALESCE((item->>'created_at')::TIMESTAMP, NOW()), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, date_from = EXCLUDED.date_from, date_to = EXCLUDED.date_to, category_id = EXCLUDED.category_id, updated_at = NOW();
      cnt_tender_plans := cnt_tender_plans + 1;
    END IF;
  END LOOP;

  -- 11. contracts
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contracts', '[]'::JSONB))
  LOOP
    item_owner := NULLIF(item->>'owner_id', '')::UUID;
    INSERT INTO public.contracts (
      id, project_id, vendor_id, vendor_name, title, contract_number, status, signed_at, effective_from, effective_to, currency,
      base_price, retention_percent, retention_amount, warranty_months, payment_terms, scope_summary, source, source_bid_id,
      document_url, extraction_confidence, extraction_json, owner_id, organization_id, created_by, created_at, updated_at,
      vendor_rating, vendor_rating_note, vendor_rating_at, vendor_rating_by, site_setup_percent, vendor_ico
    ) VALUES (
      (item->>'id')::UUID, item->>'project_id', item->>'vendor_id', COALESCE(item->>'vendor_name', ''), COALESCE(item->>'title', ''),
      item->>'contract_number', COALESCE(item->>'status', 'draft'), (item->>'signed_at')::DATE, (item->>'effective_from')::DATE,
      (item->>'effective_to')::DATE, COALESCE(item->>'currency', 'CZK'), COALESCE((item->>'base_price')::NUMERIC, 0),
      (item->>'retention_percent')::NUMERIC, (item->>'retention_amount')::NUMERIC, (item->>'warranty_months')::INT,
      item->>'payment_terms', item->>'scope_summary', COALESCE(item->>'source', 'manual'), item->>'source_bid_id',
      item->>'document_url', (item->>'extraction_confidence')::NUMERIC, item->'extraction_json',
      COALESCE(item_owner, uid), target_org_id, COALESCE(item_owner, uid),
      COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()), NOW(),
      (item->>'vendor_rating')::NUMERIC, item->>'vendor_rating_note', (item->>'vendor_rating_at')::TIMESTAMPTZ,
      (item->>'vendor_rating_by')::UUID, (item->>'site_setup_percent')::NUMERIC, item->>'vendor_ico'
    )
    ON CONFLICT (id) DO UPDATE SET
      vendor_name = EXCLUDED.vendor_name, title = EXCLUDED.title, contract_number = EXCLUDED.contract_number,
      status = EXCLUDED.status, signed_at = EXCLUDED.signed_at, effective_from = EXCLUDED.effective_from,
      effective_to = EXCLUDED.effective_to, base_price = EXCLUDED.base_price, retention_percent = EXCLUDED.retention_percent,
      retention_amount = EXCLUDED.retention_amount, warranty_months = EXCLUDED.warranty_months, payment_terms = EXCLUDED.payment_terms,
      scope_summary = EXCLUDED.scope_summary, document_url = EXCLUDED.document_url, updated_at = NOW(),
      vendor_rating = EXCLUDED.vendor_rating, vendor_rating_note = EXCLUDED.vendor_rating_note,
      vendor_rating_at = EXCLUDED.vendor_rating_at, site_setup_percent = EXCLUDED.site_setup_percent, vendor_ico = EXCLUDED.vendor_ico
    WHERE contracts.organization_id = target_org_id;
    cnt_contracts := cnt_contracts + 1;
  END LOOP;

  -- 12. contract_amendments
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contract_amendments', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.contracts WHERE id = (item->>'contract_id')::UUID AND organization_id = target_org_id) THEN
      INSERT INTO public.contract_amendments (id, contract_id, amendment_no, signed_at, effective_from, delta_price, delta_deadline, reason, document_url, extraction_json, extraction_confidence, created_by, created_at, updated_at)
      VALUES ((item->>'id')::UUID, (item->>'contract_id')::UUID, (item->>'amendment_no')::INT, (item->>'signed_at')::DATE, (item->>'effective_from')::DATE, COALESCE((item->>'delta_price')::NUMERIC, 0), (item->>'delta_deadline')::DATE, item->>'reason', item->>'document_url', item->'extraction_json', (item->>'extraction_confidence')::NUMERIC, uid, COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()), NOW())
      ON CONFLICT (id) DO UPDATE SET amendment_no = EXCLUDED.amendment_no, signed_at = EXCLUDED.signed_at, effective_from = EXCLUDED.effective_from, delta_price = EXCLUDED.delta_price, delta_deadline = EXCLUDED.delta_deadline, reason = EXCLUDED.reason, document_url = EXCLUDED.document_url, updated_at = NOW();
      cnt_contract_amendments := cnt_contract_amendments + 1;
    END IF;
  END LOOP;

  -- 13. contract_drawdowns
  FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contract_drawdowns', '[]'::JSONB))
  LOOP
    IF EXISTS (SELECT 1 FROM public.contracts WHERE id = (item->>'contract_id')::UUID AND organization_id = target_org_id) THEN
      INSERT INTO public.contract_drawdowns (id, contract_id, period, claimed_amount, approved_amount, note, document_url, extraction_json, extraction_confidence, created_by, created_at, updated_at)
      VALUES ((item->>'id')::UUID, (item->>'contract_id')::UUID, item->>'period', COALESCE((item->>'claimed_amount')::NUMERIC, 0), COALESCE((item->>'approved_amount')::NUMERIC, 0), item->>'note', item->>'document_url', item->'extraction_json', (item->>'extraction_confidence')::NUMERIC, uid, COALESCE((item->>'created_at')::TIMESTAMPTZ, NOW()), NOW())
      ON CONFLICT (id) DO UPDATE SET period = EXCLUDED.period, claimed_amount = EXCLUDED.claimed_amount, approved_amount = EXCLUDED.approved_amount, note = EXCLUDED.note, document_url = EXCLUDED.document_url, updated_at = NOW();
      cnt_contract_drawdowns := cnt_contract_drawdowns + 1;
    END IF;
  END LOOP;

  -- Log restore to history
  INSERT INTO public.backup_history (user_id, organization_id, backup_type, record_counts)
  VALUES (uid, target_org_id, 'tenant', jsonb_build_object(
    'operation', 'restore',
    'projects', cnt_projects, 'demand_categories', cnt_categories,
    'bids', cnt_bids, 'bid_tags', cnt_bid_tags,
    'subcontractors', cnt_subcontractors, 'subcontractor_statuses', cnt_statuses,
    'tender_plans', cnt_tender_plans, 'contracts', cnt_contracts,
    'contract_amendments', cnt_contract_amendments, 'contract_drawdowns', cnt_contract_drawdowns,
    'project_contracts', cnt_project_contracts, 'project_investor_financials', cnt_project_financials,
    'project_amendments', cnt_project_amendments
  ));

  RETURN jsonb_build_object(
    'success', true,
    'restored_projects', cnt_projects, 'restored_demand_categories', cnt_categories,
    'restored_bids', cnt_bids, 'restored_bid_tags', cnt_bid_tags,
    'restored_subcontractors', cnt_subcontractors, 'restored_subcontractor_statuses', cnt_statuses,
    'restored_tender_plans', cnt_tender_plans, 'restored_contracts', cnt_contracts,
    'restored_contract_amendments', cnt_contract_amendments, 'restored_contract_drawdowns', cnt_contract_drawdowns,
    'restored_project_contracts', cnt_project_contracts, 'restored_project_investor_financials', cnt_project_financials,
    'restored_project_amendments', cnt_project_amendments
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 6. Feature flag entries for backup functionality
-- -----------------------------------------------------------------------------

-- First, register feature definitions in the parent table
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('data_backup', 'Záloha dat', 'Záloha a obnova uživatelských dat', 'Správa', 200),
  ('data_backup_tenant', 'Záloha organizace', 'Záloha a obnova dat celé organizace', 'Správa', 210)
ON CONFLICT (key) DO NOTHING;

-- Then, set tier flags
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'data_backup', false),
  ('free', 'data_backup_tenant', false),
  ('starter', 'data_backup', false),
  ('starter', 'data_backup_tenant', false),
  ('pro', 'data_backup', true),
  ('pro', 'data_backup_tenant', false),
  ('enterprise', 'data_backup', true),
  ('enterprise', 'data_backup_tenant', true)
ON CONFLICT (tier, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

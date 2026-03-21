-- Migration: clone_tender_to_realization
-- Description: Secure RPC to atomically clone a tender project into realization

CREATE OR REPLACE FUNCTION public.clone_tender_project_to_realization(project_id_input VARCHAR)
RETURNS TABLE(cloned_project_id VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_source_project public.projects%ROWTYPE;
  v_new_project_id VARCHAR(36) := gen_random_uuid()::text;
  v_new_category_id VARCHAR(36);
  v_new_tender_plan_id VARCHAR(36);
  v_new_amendment_id VARCHAR(36);
  v_new_bid_id VARCHAR(36);
  v_old_category_id VARCHAR(36);
  v_category_id_column TEXT;
  v_effective_price_display TEXT;
  v_effective_price_history JSONB;
  v_source_category RECORD;
  v_source_plan RECORD;
  v_source_amendment RECORD;
  v_source_bid RECORD;
  v_has_column BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Uživatel není přihlášen.';
  END IF;

  SELECT p.*
  INTO v_source_project
  FROM public.projects p
  WHERE p.id = project_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zdrojový projekt neexistuje.';
  END IF;

  IF v_source_project.status IS DISTINCT FROM 'tender' THEN
    RAISE EXCEPTION 'Klonovat do realizace lze pouze projekt ve stavu tender.';
  END IF;

  IF NOT (
    v_source_project.owner_id = v_user_id
    OR v_source_project.owner_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.project_shares ps
      WHERE ps.project_id = v_source_project.id
        AND ps.user_id = v_user_id
        AND ps.permission = 'edit'
    )
  ) THEN
    RAISE EXCEPTION 'Nemáte oprávnění klonovat tento projekt.';
  END IF;

  INSERT INTO public.projects (
    id,
    name,
    location,
    status,
    owner_id,
    organization_id,
    is_demo,
    investor,
    technical_supervisor,
    finish_date,
    site_manager,
    construction_manager,
    construction_technician,
    planned_cost
  )
  SELECT
    v_new_project_id,
    p.name,
    p.location,
    'realization',
    p.owner_id,
    p.organization_id,
    COALESCE(p.is_demo, false),
    p.investor,
    p.technical_supervisor,
    p.finish_date,
    p.site_manager,
    p.construction_manager,
    p.construction_technician,
    p.planned_cost
  FROM public.projects p
  WHERE p.id = v_source_project.id;

  FOR v_source_plan IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name IN (
        'documentation_link',
        'document_links',
        'inquiry_letter_link',
        'material_inquiry_template_link',
        'losers_email_template_link',
        'price_list_link',
        'dochub_enabled',
        'dochub_provider',
        'dochub_mode',
        'dochub_structure_v1',
        'dochub_structure_version',
        'dochub_settings'
      )
  LOOP
    EXECUTE format(
      'UPDATE public.projects target
       SET %1$I = source.%1$I
       FROM public.projects source
       WHERE target.id = $1
         AND source.id = $2',
      v_source_plan.column_name
    )
    USING v_new_project_id, v_source_project.id;
  END LOOP;

  FOR v_source_plan IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name IN (
        'dochub_root_link',
        'dochub_root_id',
        'dochub_root_name',
        'dochub_drive_id',
        'dochub_site_id',
        'dochub_root_web_url',
        'dochub_last_error',
        'dochub_autocreate_last_run_at',
        'dochub_autocreate_last_error'
      )
  LOOP
    EXECUTE format(
      'UPDATE public.projects SET %I = NULL WHERE id = $1',
      v_source_plan.column_name
    )
    USING v_new_project_id;
  END LOOP;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'dochub_status'
  )
  INTO v_has_column;
  IF v_has_column THEN
    UPDATE public.projects
    SET dochub_status = 'disconnected'
    WHERE id = v_new_project_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'dochub_autocreate_enabled'
  )
  INTO v_has_column;
  IF v_has_column THEN
    UPDATE public.projects
    SET dochub_autocreate_enabled = false
    WHERE id = v_new_project_id;
  END IF;

  INSERT INTO public.project_contracts (
    project_id,
    maturity_days,
    warranty_months,
    retention_terms,
    site_facilities_percent,
    insurance_percent
  )
  SELECT
    v_new_project_id,
    pc.maturity_days,
    pc.warranty_months,
    pc.retention_terms,
    pc.site_facilities_percent,
    pc.insurance_percent
  FROM public.project_contracts pc
  WHERE pc.project_id = v_source_project.id;

  INSERT INTO public.project_investor_financials (project_id, sod_price)
  SELECT v_new_project_id, pif.sod_price
  FROM public.project_investor_financials pif
  WHERE pif.project_id = v_source_project.id;

  FOR v_source_amendment IN
    SELECT pa.*
    FROM public.project_amendments pa
    WHERE pa.project_id = v_source_project.id
    ORDER BY pa.created_at, pa.id
  LOOP
    v_new_amendment_id := gen_random_uuid()::text;
    INSERT INTO public.project_amendments (id, project_id, label, price)
    VALUES (v_new_amendment_id, v_new_project_id, v_source_amendment.label, v_source_amendment.price);
  END LOOP;

  CREATE TEMP TABLE tmp_cloned_categories (
    old_category_id VARCHAR(36) PRIMARY KEY,
    new_category_id VARCHAR(36) NOT NULL
  ) ON COMMIT DROP;

  FOR v_source_category IN
    SELECT dc.*
    FROM public.demand_categories dc
    WHERE dc.project_id = v_source_project.id
    ORDER BY dc.created_at, dc.id
  LOOP
    v_new_category_id := gen_random_uuid()::text;

    INSERT INTO public.demand_categories (
      id,
      project_id,
      title,
      budget_display,
      sod_budget,
      plan_budget,
      status,
      description,
      deadline,
      realization_start,
      realization_end,
      work_items
    )
    VALUES (
      v_new_category_id,
      v_new_project_id,
      v_source_category.title,
      v_source_category.budget_display,
      v_source_category.sod_budget,
      v_source_category.plan_budget,
      v_source_category.status,
      v_source_category.description,
      NULL,
      NULL,
      NULL,
      v_source_category.work_items
    );

    INSERT INTO tmp_cloned_categories (old_category_id, new_category_id)
    VALUES (v_source_category.id, v_new_category_id);
  END LOOP;

  FOR v_source_plan IN
    SELECT tp.*
    FROM public.tender_plans tp
    WHERE tp.project_id = v_source_project.id
    ORDER BY tp.created_at, tp.id
  LOOP
    v_new_tender_plan_id := gen_random_uuid()::text;

    INSERT INTO public.tender_plans (
      id,
      project_id,
      name,
      date_from,
      date_to,
      category_id
    )
    VALUES (
      v_new_tender_plan_id,
      v_new_project_id,
      v_source_plan.name,
      NULL,
      NULL,
      (
        SELECT tcc.new_category_id
        FROM tmp_cloned_categories tcc
        WHERE tcc.old_category_id = v_source_plan.category_id
      )
    );
  END LOOP;

  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bids'
          AND column_name = 'demand_category_id'
      ) THEN 'demand_category_id'
      ELSE 'category_id'
    END
  INTO v_category_id_column;

  FOR v_source_category IN
    SELECT tcc.old_category_id, tcc.new_category_id
    FROM tmp_cloned_categories tcc
  LOOP
    v_old_category_id := v_source_category.old_category_id;
    v_new_category_id := v_source_category.new_category_id;

    FOR v_source_bid IN EXECUTE format(
      'SELECT b.id, b.subcontractor_id, b.company_name, b.contact_person, b.email, b.phone, b.price, b.price_display, b.price_history
       FROM public.bids b
       WHERE b.%I = $1
       ORDER BY b.created_at, b.id',
      v_category_id_column
    )
    USING v_old_category_id
    LOOP
      v_effective_price_display := NULL;

      IF COALESCE(v_source_bid.price, 0) > 0 THEN
        v_effective_price_display := NULLIF(BTRIM(COALESCE(v_source_bid.price_display, '')), '');
      END IF;

      IF v_effective_price_display IS NULL AND v_source_bid.price_history IS NOT NULL THEN
        SELECT NULLIF(BTRIM(value), '')
        INTO v_effective_price_display
        FROM jsonb_each_text(v_source_bid.price_history)
        ORDER BY CASE WHEN key ~ '^\d+$' THEN key::INT ELSE -1 END DESC, key DESC
        LIMIT 1;
      END IF;

      IF v_effective_price_display IS NULL THEN
        CONTINUE;
      END IF;

      v_effective_price_history := jsonb_build_object('0', v_effective_price_display);
      v_new_bid_id := gen_random_uuid()::text;

      EXECUTE format(
        'INSERT INTO public.bids (
          id,
          %I,
          subcontractor_id,
          company_name,
          contact_person,
          email,
          phone,
          price,
          price_display,
          price_history,
          notes,
          status,
          update_date,
          selection_round,
          contracted
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          NULL,
          ''?'',
          $8,
          NULL,
          ''contacted'',
          NULL,
          0,
          false
        )',
        v_category_id_column
      )
      USING
        v_new_bid_id,
        v_new_category_id,
        v_source_bid.subcontractor_id,
        v_source_bid.company_name,
        v_source_bid.contact_person,
        v_source_bid.email,
        v_source_bid.phone,
        v_effective_price_history;
    END LOOP;
  END LOOP;

  INSERT INTO public.project_shares (project_id, user_id, permission)
  SELECT
    v_new_project_id,
    ps.user_id,
    ps.permission
  FROM public.project_shares ps
  WHERE ps.project_id = v_source_project.id
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN QUERY SELECT v_new_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_tender_project_to_realization(VARCHAR) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Include the minimal investor financial values required by tenant overview charts.
-- The SECURITY DEFINER function scopes every source table through org_projects.

CREATE OR REPLACE FUNCTION public.get_overview_tenant_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  org_ids UUID[];
  result JSONB;
BEGIN
  SELECT public.get_my_org_ids() INTO org_ids;

  IF org_ids IS NULL OR array_length(org_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'projects', '[]'::jsonb,
      'projectDetails', '{}'::jsonb
    );
  END IF;

  WITH org_projects AS (
    SELECT p.id, p.name, p.status, p.location, p.finish_date
    FROM public.projects p
    WHERE p.organization_id = ANY(org_ids)
  ),
  categories AS (
    SELECT dc.*
    FROM public.demand_categories dc
    JOIN org_projects op ON op.id = dc.project_id
  ),
  bids_raw AS (
    SELECT b.*
    FROM public.bids b
    JOIN categories c ON c.id = b.demand_category_id
  ),
  bids_by_category AS (
    SELECT
      b.demand_category_id AS category_id,
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'subcontractorId', b.subcontractor_id,
          'companyName', COALESCE(s.company_name, 'Neznámý dodavatel'),
          'contactPerson', COALESCE(s.contact_person_name, ''),
          'email', s.email,
          'phone', s.phone,
          'price', COALESCE(b.price_display, b.price::text),
          'priceHistory', b.price_history,
          'notes', b.notes,
          'status', b.status,
          'updateDate', b.update_date,
          'selectionRound', b.selection_round,
          'contracted', b.contracted
        )
      ) AS bids,
      COUNT(*) AS bid_count
    FROM bids_raw b
    LEFT JOIN public.subcontractors s
      ON s.id = b.subcontractor_id
      AND (
        s.organization_id = ANY(org_ids)
        OR s.owner_id = auth.uid()
      )
    GROUP BY b.demand_category_id
  ),
  categories_by_project AS (
    SELECT
      c.project_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'budget', COALESCE(c.budget_display, ''),
          'sodBudget', COALESCE(c.sod_budget, 0),
          'planBudget', COALESCE(c.plan_budget, 0),
          'status', COALESCE(c.status, 'open'),
          'subcontractorCount', COALESCE(bc.bid_count, 0),
          'description', COALESCE(c.description, ''),
          'workItems', COALESCE(c.work_items, ARRAY[]::text[]),
          'deadline', c.deadline,
          'realizationStart', c.realization_start,
          'realizationEnd', c.realization_end
        )
      ) AS categories
    FROM categories c
    LEFT JOIN bids_by_category bc ON bc.category_id = c.id
    GROUP BY c.project_id
  ),
  bids_by_project AS (
    SELECT
      c.project_id,
      jsonb_object_agg(c.id, COALESCE(bc.bids, '[]'::jsonb)) AS bids
    FROM categories c
    LEFT JOIN bids_by_category bc ON bc.category_id = c.id
    GROUP BY c.project_id
  ),
  investor_financials AS (
    SELECT pif.project_id, pif.sod_price
    FROM public.project_investor_financials pif
    JOIN org_projects op ON op.id = pif.project_id
  ),
  amendments_by_project AS (
    SELECT
      pa.project_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pa.id,
          'label', COALESCE(pa.label, ''),
          'price', COALESCE(pa.price, 0)
        )
        ORDER BY pa.created_at, pa.id
      ) AS amendments
    FROM public.project_amendments pa
    JOIN org_projects op ON op.id = pa.project_id
    GROUP BY pa.project_id
  ),
  project_details AS (
    SELECT
      op.id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', op.id,
          'title', op.name,
          'location', COALESCE(op.location, ''),
          'finishDate', COALESCE(op.finish_date, ''),
          'siteManager', '',
          'categories', COALESCE(cb.categories, '[]'::jsonb),
          'bids', COALESCE(bp.bids, '{}'::jsonb),
          'investorFinancials', CASE
            WHEN inf.project_id IS NOT NULL OR abp.project_id IS NOT NULL THEN
              jsonb_build_object(
                'sodPrice', COALESCE(inf.sod_price, 0),
                'amendments', COALESCE(abp.amendments, '[]'::jsonb)
              )
            ELSE NULL
          END
        )
      ) AS details
    FROM org_projects op
    LEFT JOIN categories_by_project cb ON cb.project_id = op.id
    LEFT JOIN bids_by_project bp ON bp.project_id = op.id
    LEFT JOIN investor_financials inf ON inf.project_id = op.id
    LEFT JOIN amendments_by_project abp ON abp.project_id = op.id
  )
  SELECT jsonb_build_object(
    'projects', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', op.id,
          'name', op.name,
          'location', COALESCE(op.location, ''),
          'status', COALESCE(op.status, 'realization')
        )
      ),
      '[]'::jsonb
    ),
    'projectDetails', COALESCE(jsonb_object_agg(pd.id, pd.details), '{}'::jsonb)
  )
  INTO result
  FROM org_projects op
  LEFT JOIN project_details pd ON pd.id = op.id;

  RETURN COALESCE(
    result,
    jsonb_build_object('projects', '[]'::jsonb, 'projectDetails', '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_overview_tenant_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;

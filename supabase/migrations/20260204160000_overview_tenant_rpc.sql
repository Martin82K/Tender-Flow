-- Migration: overview_tenant_rpc
-- Date: 2026-02-04
-- Description: Tenant-wide overview data for "Přehledy" only (RPC)

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
    LEFT JOIN public.subcontractors s ON s.id = b.subcontractor_id
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
          'documents', COALESCE(c.documents, '[]'::jsonb),
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
  project_details AS (
    SELECT
      op.id,
      jsonb_build_object(
        'id', op.id,
        'title', op.name,
        'location', COALESCE(op.location, ''),
        'finishDate', COALESCE(op.finish_date, ''),
        'siteManager', '',
        'categories', COALESCE(cb.categories, '[]'::jsonb),
        'bids', COALESCE(bp.bids, '{}'::jsonb)
      ) AS details
    FROM org_projects op
    LEFT JOIN categories_by_project cb ON cb.project_id = op.id
    LEFT JOIN bids_by_project bp ON bp.project_id = op.id
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

GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;

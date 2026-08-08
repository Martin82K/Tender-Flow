-- Extend the existing read-only contract overview allowlist with stored
-- contract parameters and the directly attached signed contract/amendment
-- document. Authorization scope, tenant isolation and audit remain unchanged.

DROP FUNCTION IF EXISTS public.get_contract_overview(UUID, BOOLEAN);

CREATE FUNCTION public.get_contract_overview(
  organization_id_input UUID DEFAULT NULL,
  include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE(
  organization_id UUID, project_id TEXT, project_name TEXT, project_status TEXT,
  contract_id UUID, contract_partner TEXT, contract_title TEXT, contract_number TEXT,
  contract_status TEXT, currency TEXT, base_price NUMERIC, current_total NUMERIC,
  approved_drawdown NUMERIC, remaining_amount NUMERIC,
  retention_percent NUMERIC,
  retention_short_percent NUMERIC, retention_short_amount NUMERIC,
  retention_short_release_on DATE, retention_long_percent NUMERIC,
  retention_long_amount NUMERIC, retention_long_release_on DATE,
  warranty_months INTEGER, payment_terms TEXT,
  signed_at DATE, effective_from DATE, effective_to DATE,
  document_url TEXT, document_storage_path TEXT, document_file_name TEXT,
  amendments JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_org UUID;
  caller_scope TEXT;
  result_count INTEGER;
BEGIN
  caller_org := organization_id_input;
  IF caller_org IS NULL THEN
    SELECT om.organization_id INTO caller_org
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND public.contract_overview_access_scope(om.organization_id, auth.uid()) <> 'none'
    ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
    LIMIT 1;
  END IF;

  caller_scope := public.contract_overview_access_scope(caller_org, auth.uid());
  IF caller_org IS NULL OR caller_scope = 'none' THEN
    RAISE EXCEPTION 'Přístup ke smluvnímu přehledu nebyl udělen';
  END IF;

  RETURN QUERY
  SELECT p.organization_id, p.id::text, p.name::text, p.status::text,
    c.id, c.vendor_name::text, c.title::text, c.contract_number::text,
    c.status::text, c.currency::text, c.base_price,
    c.base_price + COALESCE(a.amendments_total, 0),
    COALESCE(d.approved_total, 0),
    c.base_price + COALESCE(a.amendments_total, 0) - COALESCE(d.approved_total, 0),
    c.retention_percent,
    c.retention_short_percent, c.retention_short_amount,
    c.retention_short_release_on, c.retention_long_percent,
    c.retention_long_amount, c.retention_long_release_on,
    c.warranty_months, c.payment_terms,
    c.signed_at, c.effective_from, c.effective_to,
    c.document_url, c.document_storage_path, c.document_file_name,
    COALESCE(a.amendments, '[]'::jsonb)
  FROM public.contracts c
  JOIN public.projects p ON p.id = c.project_id AND p.organization_id = caller_org
  LEFT JOIN LATERAL (
    SELECT
      SUM(ca.delta_price) AS amendments_total,
      jsonb_agg(
        jsonb_build_object(
          'id', ca.id,
          'amendment_no', ca.amendment_no,
          'signed_at', ca.signed_at,
          'effective_from', ca.effective_from,
          'delta_price', ca.delta_price,
          'document_url', ca.document_url,
          'document_storage_path', ca.document_storage_path,
          'document_file_name', ca.document_file_name
        ) ORDER BY ca.amendment_no
      ) AS amendments
    FROM public.contract_amendments ca
    WHERE ca.contract_id = c.id
  ) a ON true
  LEFT JOIN (
    SELECT cd.contract_id, SUM(cd.approved_amount) approved_total
    FROM public.contract_drawdowns cd GROUP BY cd.contract_id
  ) d ON d.contract_id = c.id
  WHERE (include_archived OR p.status <> 'archived')
    AND (
      caller_scope = 'organization'
      OR EXISTS (
        SELECT 1
        FROM public.project_shares ps
        WHERE ps.project_id = p.id AND ps.user_id = auth.uid()
          AND ps.legacy_external = false
      )
    )
  ORDER BY p.name, c.vendor_name, c.title;

  GET DIAGNOSTICS result_count = ROW_COUNT;
  INSERT INTO public.project_access_audit_events(
    organization_id, actor_user_id, event_type, metadata
  ) VALUES (
    caller_org, auth.uid(), 'contract_overview_access',
    jsonb_build_object(
      'include_archived', include_archived,
      'result_count', result_count,
      'access_scope', caller_scope
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) TO authenticated;

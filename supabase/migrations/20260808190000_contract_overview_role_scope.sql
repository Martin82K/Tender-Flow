-- Contract overview remains role-matrix-only, but each professional role can
-- receive either organization-wide visibility or visibility limited to the
-- projects where the user is an explicit project_shares team member.

-- Retire the former unspecific matrix key without translating it to either
-- scope. This is conservative and cannot expand access.
WITH retired AS (
  UPDATE public.organization_role_permissions
  SET access_level = 'none', can_approve = false, updated_at = now()
  WHERE permission_key = 'contract_overview.read'
    AND (access_level <> 'none' OR can_approve = true)
  RETURNING organization_id, role_key, updated_by
)
INSERT INTO public.project_access_audit_events(
  organization_id, actor_user_id, event_type, metadata
)
SELECT organization_id, updated_by, 'role_permission_set', jsonb_build_object(
  'role_key', role_key,
  'permission_key', 'contract_overview.read',
  'access_level', 'none',
  'reason', 'retired_unspecific_contract_overview_scope'
)
FROM retired;

CREATE OR REPLACE FUNCTION public.set_organization_role_permission(
  org_id_input UUID,
  role_key_input TEXT,
  permission_key_input TEXT,
  access_level_input TEXT,
  can_approve_input BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  opposite_scope_key TEXT;
BEGIN
  IF NOT public.is_active_org_admin_or_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF role_key_input NOT IN (
    'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
    'technician', 'contracts_department', 'economist'
  ) THEN RAISE EXCEPTION 'Invalid professional role'; END IF;
  IF permission_key_input !~ '^[a-z][a-z0-9_.]{2,100}$' THEN
    RAISE EXCEPTION 'Invalid permission key';
  END IF;
  IF access_level_input NOT IN ('none', 'read', 'write') THEN
    RAISE EXCEPTION 'Invalid access level';
  END IF;
  IF permission_key_input = 'contract_overview.read' THEN
    RAISE EXCEPTION 'Obsolete contract overview permission key';
  END IF;
  IF permission_key_input IN (
    'contract_overview.organization', 'contract_overview.project_team'
  ) THEN
    IF access_level_input NOT IN ('none', 'read') OR can_approve_input THEN
      RAISE EXCEPTION 'Contract overview is read-only and does not support approval';
    END IF;
    opposite_scope_key := CASE permission_key_input
      WHEN 'contract_overview.organization' THEN 'contract_overview.project_team'
      ELSE 'contract_overview.organization'
    END;
  END IF;

  INSERT INTO public.organization_role_permissions(
    organization_id, role_key, permission_key, access_level,
    can_approve, updated_by, updated_at
  ) VALUES (
    org_id_input, role_key_input, permission_key_input, access_level_input,
    can_approve_input, auth.uid(), now()
  )
  ON CONFLICT (organization_id, role_key, permission_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_approve = EXCLUDED.can_approve,
    updated_by = auth.uid(),
    updated_at = now();

  -- Selecting one scope atomically disables the other one for the same role.
  IF access_level_input = 'read' AND opposite_scope_key IS NOT NULL THEN
    INSERT INTO public.organization_role_permissions(
      organization_id, role_key, permission_key, access_level,
      can_approve, updated_by, updated_at
    ) VALUES (
      org_id_input, role_key_input, opposite_scope_key, 'none',
      false, auth.uid(), now()
    )
    ON CONFLICT (organization_id, role_key, permission_key) DO UPDATE SET
      access_level = 'none',
      can_approve = false,
      updated_by = auth.uid(),
      updated_at = now();
  END IF;

  INSERT INTO public.project_access_audit_events(
    organization_id, actor_user_id, event_type, metadata
  ) VALUES (
    org_id_input, auth.uid(), 'role_permission_set',
    jsonb_build_object(
      'role_key', role_key_input,
      'permission_key', permission_key_input,
      'access_level', access_level_input,
      'can_approve', can_approve_input,
      'mutually_exclusive_permission_disabled',
        CASE WHEN access_level_input = 'read' THEN opposite_scope_key ELSE NULL END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contract_overview_access_scope(
  org_id_input UUID,
  user_id_input UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.organization_role_permissions orp
        ON orp.organization_id = om.organization_id
       AND orp.role_key = om.professional_role
       AND orp.permission_key = 'contract_overview.organization'
       AND orp.access_level = 'read'
      WHERE om.organization_id = org_id_input
        AND om.user_id = user_id_input
        AND om.is_active = true
    ) THEN 'organization'
    WHEN EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.organization_role_permissions orp
        ON orp.organization_id = om.organization_id
       AND orp.role_key = om.professional_role
       AND orp.permission_key = 'contract_overview.project_team'
       AND orp.access_level = 'read'
      WHERE om.organization_id = org_id_input
        AND om.user_id = user_id_input
        AND om.is_active = true
    ) THEN 'project_team'
    ELSE 'none'
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_contract_overview_access(
  org_id_input UUID,
  user_id_input UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.contract_overview_access_scope(org_id_input, user_id_input) <> 'none';
$$;

CREATE OR REPLACE FUNCTION public.get_contract_overview(
  organization_id_input UUID DEFAULT NULL,
  include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE(
  organization_id UUID, project_id TEXT, project_name TEXT, project_status TEXT,
  contract_id UUID, contract_partner TEXT, contract_title TEXT, contract_number TEXT,
  contract_status TEXT, currency TEXT, base_price NUMERIC, current_total NUMERIC,
  approved_drawdown NUMERIC, remaining_amount NUMERIC, retention_percent NUMERIC,
  warranty_months INTEGER, signed_at DATE, effective_from DATE, effective_to DATE
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
    c.retention_percent, c.warranty_months, c.signed_at, c.effective_from, c.effective_to
  FROM public.contracts c
  JOIN public.projects p ON p.id = c.project_id AND p.organization_id = caller_org
  LEFT JOIN (
    SELECT ca.contract_id, SUM(ca.delta_price) amendments_total
    FROM public.contract_amendments ca GROUP BY ca.contract_id
  ) a ON a.contract_id = c.id
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

REVOKE ALL ON FUNCTION public.contract_overview_access_scope(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_contract_overview_access(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_organization_role_permission(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.contract_overview_access_scope(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_contract_overview_access(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_role_permission(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

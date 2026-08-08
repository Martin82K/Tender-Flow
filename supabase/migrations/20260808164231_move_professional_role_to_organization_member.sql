-- Move professional roles from project membership to organization membership.
-- Project shares remain the source of project access only.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS professional_role TEXT;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_professional_role_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_professional_role_check CHECK (
    professional_role IS NULL OR professional_role IN (
      'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
      'technician', 'contracts_department', 'economist'
    )
  );
CREATE INDEX IF NOT EXISTS idx_organization_members_org_professional_role
  ON public.organization_members(organization_id, professional_role)
  WHERE professional_role IS NOT NULL AND is_active = true;

-- Abort rather than guess if a member acquired conflicting per-project roles
-- between the preflight audit and this transactional migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.project_shares ps
    JOIN public.projects p ON p.id = ps.project_id
    WHERE ps.professional_role IS NOT NULL
    GROUP BY p.organization_id, ps.user_id
    HAVING COUNT(DISTINCT ps.professional_role) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting project professional roles require manual resolution';
  END IF;
END;
$$;

-- Conservative backfill: only one unambiguous role per organization member.
UPDATE public.organization_members om
SET professional_role = source.professional_role
FROM (
  SELECT p.organization_id, ps.user_id, MIN(ps.professional_role) AS professional_role
  FROM public.project_shares ps
  JOIN public.projects p ON p.id = ps.project_id
  WHERE ps.professional_role IS NOT NULL
  GROUP BY p.organization_id, ps.user_id
  HAVING COUNT(DISTINCT ps.professional_role) = 1
) source
WHERE om.organization_id = source.organization_id
  AND om.user_id = source.user_id
  AND om.professional_role IS NULL;

ALTER TABLE public.project_access_audit_events
  DROP CONSTRAINT IF EXISTS project_access_audit_events_event_type_check;
ALTER TABLE public.project_access_audit_events
  ADD CONSTRAINT project_access_audit_events_event_type_check CHECK (event_type IN (
    'project_created', 'team_member_set', 'team_member_removed',
    'project_archived', 'project_restored', 'contract_overview_access',
    'contract_overview_permission_set', 'role_permission_set',
    'project_ownership_transferred', 'organization_professional_role_set'
  ));

DROP FUNCTION IF EXISTS public.get_org_members(UUID);
CREATE FUNCTION public.get_org_members(org_id_input UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  professional_role TEXT,
  joined_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_org_member(org_id_input) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT q.user_id, q.email, q.display_name, q.role, q.professional_role, q.joined_at, q.is_active
  FROM (
    SELECT DISTINCT ON (om.user_id)
      om.user_id::UUID,
      u.email::TEXT,
      up.display_name::TEXT,
      om.role::TEXT,
      om.professional_role::TEXT,
      om.created_at::TIMESTAMPTZ,
      om.is_active::BOOLEAN
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE om.organization_id = org_id_input
    ORDER BY om.user_id, om.created_at ASC
  ) q(user_id, email, display_name, role, professional_role, joined_at, is_active)
  ORDER BY q.joined_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_member_professional_role(
  org_id_input UUID,
  user_id_input UUID,
  professional_role_input TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE previous_role TEXT;
BEGIN
  IF NOT public.is_active_org_admin_or_owner(org_id_input) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF professional_role_input IS NOT NULL AND professional_role_input NOT IN (
    'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
    'technician', 'contracts_department', 'economist'
  ) THEN RAISE EXCEPTION 'Invalid professional role'; END IF;

  SELECT om.professional_role INTO previous_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input
    AND om.user_id = user_id_input
    AND om.is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active organization member required'; END IF;

  UPDATE public.organization_members
  SET professional_role = professional_role_input
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  INSERT INTO public.project_access_audit_events(
    organization_id, actor_user_id, target_user_id, event_type, metadata
  ) VALUES (
    org_id_input, auth.uid(), user_id_input, 'organization_professional_role_set',
    jsonb_build_object('previous_role', previous_role, 'professional_role', professional_role_input)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_project_action(project_id_input TEXT, action_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  project_status TEXT;
  project_demo BOOLEAN;
  project_org UUID;
  access_kind TEXT;
  share_permission TEXT;
  professional_role_value TEXT;
  contract_level TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT p.status, COALESCE(p.is_demo, false), p.organization_id,
    public.effective_project_role(p.id, auth.uid()), ps.permission, om.professional_role
  INTO project_status, project_demo, project_org, access_kind,
    share_permission, professional_role_value
  FROM public.projects p
  LEFT JOIN public.project_shares ps
    ON ps.project_id = p.id AND ps.user_id = auth.uid()
  LEFT JOIN public.organization_members om
    ON om.organization_id = p.organization_id
   AND om.user_id = auth.uid() AND om.is_active = true
  WHERE p.id = project_id_input;
  IF NOT FOUND THEN RETURN false; END IF;

  IF project_demo AND action_input = 'view' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM public.user_hidden_projects uhp
      WHERE uhp.project_id = project_id_input AND uhp.user_id = auth.uid()
    );
  END IF;
  IF access_kind IS NULL THEN RETURN false; END IF;
  IF action_input = 'view' THEN RETURN true; END IF;
  IF project_status = 'archived' THEN
    RETURN action_input = 'restore' AND access_kind = 'system_owner';
  END IF;
  IF action_input IN ('manage_team', 'archive', 'delete') THEN
    RETURN access_kind = 'system_owner';
  END IF;
  IF action_input IN ('view_contracts', 'edit_contracts') THEN
    IF access_kind = 'system_owner' THEN RETURN public.user_has_feature('module_contracts'); END IF;
    IF access_kind = 'legacy_external' OR professional_role_value IS NULL THEN RETURN false; END IF;
    contract_level := public.organization_role_permission_level(
      project_org, professional_role_value, 'contracts.records'
    );
    RETURN public.user_has_feature('module_contracts') AND CASE
      WHEN action_input = 'view_contracts' THEN contract_level IN ('read', 'write')
      ELSE contract_level = 'write'
    END;
  END IF;
  IF action_input = 'edit' THEN
    RETURN (
      access_kind = 'system_owner'
      OR (access_kind = 'team_member' AND share_permission = 'edit')
    ) AND public.user_has_feature('module_projects');
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_project_with_team(
  project_id_input TEXT,
  name_input TEXT,
  location_input TEXT,
  status_input TEXT,
  organization_id_input UUID,
  team_input JSONB DEFAULT '[]'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE member JSONB; member_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF status_input NOT IN ('tender', 'realization') THEN RAISE EXCEPTION 'Invalid project status'; END IF;
  IF NOT public.can_create_project() OR NOT public.user_has_feature('module_projects') THEN
    RAISE EXCEPTION 'Project creation is not permitted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_id_input
      AND om.user_id = auth.uid() AND om.is_active = true
  ) THEN RAISE EXCEPTION 'Active organization membership required'; END IF;

  INSERT INTO public.projects(id, name, location, status, owner_id, organization_id)
  VALUES (
    project_id_input, btrim(name_input), btrim(COALESCE(location_input, '')),
    status_input, auth.uid(), organization_id_input
  );

  FOR member IN SELECT value FROM jsonb_array_elements(COALESCE(team_input, '[]'::jsonb)) LOOP
    member_id := (member->>'user_id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id_input
        AND om.user_id = member_id AND om.is_active = true
    ) THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;
    INSERT INTO public.project_shares(
      project_id, user_id, role, permission, legacy_external, created_by, updated_at
    ) VALUES (
      project_id_input, member_id, 'team_member', 'edit', false, auth.uid(), now()
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      role = 'team_member', permission = 'edit', legacy_external = false, updated_at = now();
  END LOOP;

  INSERT INTO public.project_access_audit_events(
    organization_id, project_id, actor_user_id, event_type, metadata
  ) VALUES (
    organization_id_input, project_id_input, auth.uid(), 'project_created',
    jsonb_build_object('team_size', jsonb_array_length(COALESCE(team_input, '[]'::jsonb)))
  );
  RETURN project_id_input;
END;
$$;

DROP FUNCTION IF EXISTS public.get_project_team(TEXT);
CREATE FUNCTION public.get_project_team(project_id_input TEXT)
RETURNS TABLE(
  user_id UUID, email TEXT, display_name TEXT, access_kind TEXT,
  professional_role TEXT, legacy_external BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_project_action(project_id_input, 'view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.can_project_action(project_id_input, 'manage_team') THEN
    RETURN QUERY
    SELECT ps.user_id, au.email::text, COALESCE(up.display_name, au.email)::text,
      CASE WHEN ps.legacy_external THEN 'legacy_external' ELSE 'team_member' END,
      om.professional_role, ps.legacy_external
    FROM public.project_shares ps
    JOIN public.projects p ON p.id = ps.project_id
    JOIN auth.users au ON au.id = ps.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id AND om.user_id = ps.user_id AND om.is_active = true
    WHERE ps.project_id = project_id_input AND ps.user_id = auth.uid();
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.owner_id, au.email::text, COALESCE(up.display_name, au.email)::text,
    'system_owner'::text, owner_org.professional_role, false
  FROM public.projects p
  JOIN auth.users au ON au.id = p.owner_id
  LEFT JOIN public.user_profiles up ON up.user_id = p.owner_id
  LEFT JOIN public.organization_members owner_org
    ON owner_org.organization_id = p.organization_id AND owner_org.user_id = p.owner_id AND owner_org.is_active = true
  WHERE p.id = project_id_input
  UNION ALL
  SELECT ps.user_id, au.email::text, COALESCE(up.display_name, au.email)::text,
    CASE WHEN ps.legacy_external THEN 'legacy_external' ELSE 'team_member' END,
    om.professional_role, ps.legacy_external
  FROM public.project_shares ps
  JOIN public.projects p ON p.id = ps.project_id
  JOIN auth.users au ON au.id = ps.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id
  LEFT JOIN public.organization_members om
    ON om.organization_id = p.organization_id AND om.user_id = ps.user_id AND om.is_active = true
  WHERE ps.project_id = project_id_input AND ps.user_id IS DISTINCT FROM p.owner_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_my_project_access();
CREATE FUNCTION public.get_my_project_access()
RETURNS TABLE(
  project_id TEXT, access_kind TEXT, professional_role TEXT,
  legacy_permission TEXT, project_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id::text, public.effective_project_role(p.id, auth.uid()),
    om.professional_role, ps.permission::text, p.status::text
  FROM public.projects p
  LEFT JOIN public.project_shares ps
    ON ps.project_id = p.id AND ps.user_id = auth.uid()
  LEFT JOIN public.organization_members om
    ON om.organization_id = p.organization_id AND om.user_id = auth.uid() AND om.is_active = true
  WHERE public.can_project_action(p.id, 'view');
$$;

-- Backward-compatible project membership RPC: role_input is deliberately ignored.
CREATE OR REPLACE FUNCTION public.set_project_team_member(
  project_id_input TEXT,
  user_id_input UUID,
  role_input TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE project_org UUID;
BEGIN
  PERFORM 1 FROM public.projects WHERE id = project_id_input FOR UPDATE;
  IF NOT public.can_project_action(project_id_input, 'manage_team') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT organization_id INTO project_org FROM public.projects WHERE id = project_id_input;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = project_org
      AND om.user_id = user_id_input AND om.is_active = true
  ) THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;

  INSERT INTO public.project_shares(
    project_id, user_id, role, permission, legacy_external, created_by, updated_at
  ) VALUES (
    project_id_input, user_id_input, 'team_member', 'edit', false, auth.uid(), now()
  )
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = 'team_member', permission = 'edit', legacy_external = false, updated_at = now();

  INSERT INTO public.project_access_audit_events(
    organization_id, project_id, actor_user_id, target_user_id, event_type, metadata
  ) VALUES (
    project_org, project_id_input, auth.uid(), user_id_input,
    'team_member_set', jsonb_build_object('membership_only', true)
  );
END;
$$;

-- Retire the former per-user contract-overview mechanism without translating
-- any individual exception into a professional role (no access expansion).
WITH disabled_permissions AS (
  UPDATE public.organization_member_permissions
  SET enabled = false, updated_at = now()
  WHERE permission_key = 'contract_overview_access' AND enabled = true
  RETURNING organization_id, user_id
)
INSERT INTO public.project_access_audit_events(
  organization_id, actor_user_id, target_user_id, event_type, metadata
)
SELECT organization_id, NULL, user_id, 'contract_overview_permission_set',
  jsonb_build_object(
    'enabled', false,
    'reason', 'retired_individual_permission_in_favor_of_role_matrix'
  )
FROM disabled_permissions;

-- Organization-wide read-only contract overview is controlled exclusively by
-- the central professional-role matrix. Organization system roles do not
-- bypass the matrix; a nullable professional role means no overview access.
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
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = user_id_input
      AND om.is_active = true
      AND om.professional_role IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization_role_permissions orp
        WHERE orp.organization_id = om.organization_id
          AND orp.role_key = om.professional_role
          AND orp.permission_key = 'contract_overview.read'
          AND orp.access_level = 'read'
      )
  );
$$;

-- Remove the incorrect project-scoped source only after all functions use the
-- organization member role. Existing project membership rows remain intact.
ALTER TABLE public.project_shares DROP COLUMN IF EXISTS professional_role;

REVOKE ALL ON FUNCTION public.get_org_members(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_organization_member_professional_role(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_project_team(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_project_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_project_team_member(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_contract_overview_access(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_organization_contract_overview_permissions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_contract_overview_permission(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_member_professional_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_team(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_project_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_team_member(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_contract_overview_access(UUID, UUID) TO authenticated, service_role;

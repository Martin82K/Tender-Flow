-- Replace the rejected generic project roles with professional roles.
-- Existing access remains compatible until an administrator explicitly assigns
-- a professional role. Confirmed matrix entries are enforced immediately for
-- newly assigned roles; undefined entries are intentionally not inferred.

ALTER TABLE public.project_shares
  ADD COLUMN IF NOT EXISTS professional_role TEXT;

ALTER TABLE public.project_shares
  DROP CONSTRAINT IF EXISTS project_shares_professional_role_check;
ALTER TABLE public.project_shares
  ADD CONSTRAINT project_shares_professional_role_check CHECK (
    professional_role IS NULL OR professional_role IN (
      'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
      'technician', 'contracts_department', 'economist'
    )
  );
CREATE INDEX IF NOT EXISTS idx_project_shares_project_professional_role
  ON public.project_shares(project_id, professional_role)
  WHERE professional_role IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.organization_role_permissions (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL CHECK (role_key IN (
    'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
    'technician', 'contracts_department', 'economist'
  )),
  permission_key TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('none', 'read', 'write')),
  can_approve BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, role_key, permission_key)
);

ALTER TABLE public.organization_role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_role_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organization_role_permissions TO authenticated;
GRANT ALL ON public.organization_role_permissions TO service_role;

DROP POLICY IF EXISTS "organization role matrix visible" ON public.organization_role_permissions;
CREATE POLICY "organization role matrix visible"
ON public.organization_role_permissions FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

ALTER TABLE public.project_access_audit_events
  DROP CONSTRAINT IF EXISTS project_access_audit_events_event_type_check;
ALTER TABLE public.project_access_audit_events
  ADD CONSTRAINT project_access_audit_events_event_type_check CHECK (event_type IN (
    'project_created', 'team_member_set', 'team_member_removed',
    'project_archived', 'project_restored', 'contract_overview_access',
    'contract_overview_permission_set', 'role_permission_set',
    'project_ownership_transferred'
  ));

-- Confirmed contract baseline. Approval is deliberately left independent/off.
INSERT INTO public.organization_role_permissions (
  organization_id, role_key, permission_key, access_level, can_approve
)
SELECT o.id, role_key, permission_key,
  CASE WHEN role_key IN ('preconstruction', 'contracts_department') THEN 'write' ELSE 'read' END,
  false
FROM public.organizations o
CROSS JOIN unnest(ARRAY[
  'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
  'technician', 'contracts_department', 'economist'
]) AS roles(role_key)
CROSS JOIN unnest(ARRAY[
  'contracts.records', 'contracts.signed_document',
  'contracts.amendments', 'contracts.billing'
]) AS permissions(permission_key)
ON CONFLICT (organization_id, role_key, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_confirmed_organization_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.organization_role_permissions(
    organization_id, role_key, permission_key, access_level, can_approve
  )
  SELECT NEW.id, role_key, permission_key,
    CASE WHEN role_key IN ('preconstruction', 'contracts_department') THEN 'write' ELSE 'read' END,
    false
  FROM unnest(ARRAY[
    'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
    'technician', 'contracts_department', 'economist'
  ]) AS roles(role_key)
  CROSS JOIN unnest(ARRAY[
    'contracts.records', 'contracts.signed_document',
    'contracts.amendments', 'contracts.billing'
  ]) AS permissions(permission_key);

  INSERT INTO public.organization_role_permissions(
    organization_id, role_key, permission_key, access_level, can_approve
  )
  SELECT NEW.id, role_key, 'documents.dochub_settings', 'none', false
  FROM unnest(ARRAY['deputy', 'contracts_department', 'economist']) AS roles(role_key);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_confirmed_role_permissions ON public.organizations;
CREATE TRIGGER trg_seed_confirmed_role_permissions
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_confirmed_organization_role_permissions();

-- Explicitly confirmed: these professions do not see or configure DocHub settings.
INSERT INTO public.organization_role_permissions (
  organization_id, role_key, permission_key, access_level, can_approve
)
SELECT o.id, role_key, 'documents.dochub_settings', 'none', false
FROM public.organizations o
CROSS JOIN unnest(ARRAY['deputy', 'contracts_department', 'economist']) AS roles(role_key)
ON CONFLICT (organization_id, role_key, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_organization_role_permissions(org_id_input UUID)
RETURNS TABLE(role_key TEXT, permission_key TEXT, access_level TEXT, can_approve BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_org_member(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT p.role_key, p.permission_key, p.access_level, p.can_approve
  FROM public.organization_role_permissions p
  WHERE p.organization_id = org_id_input
  ORDER BY p.role_key, p.permission_key;
END;
$$;

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

  INSERT INTO public.project_access_audit_events(
    organization_id, actor_user_id, event_type, metadata
  ) VALUES (
    org_id_input, auth.uid(), 'role_permission_set',
    jsonb_build_object(
      'role_key', role_key_input,
      'permission_key', permission_key_input,
      'access_level', access_level_input,
      'can_approve', can_approve_input
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.organization_role_permission_level(
  org_id_input UUID,
  role_key_input TEXT,
  permission_key_input TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.access_level
  FROM public.organization_role_permissions p
  WHERE p.organization_id = org_id_input
    AND (public.is_org_member(org_id_input) OR current_user = 'service_role')
    AND p.role_key = role_key_input
    AND p.permission_key = permission_key_input
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.effective_project_role(
  project_id_input TEXT,
  user_id_input UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p.owner_id = user_id_input
      AND (p.organization_id IS NULL OR om.user_id IS NOT NULL) THEN 'system_owner'
    WHEN ps.legacy_external = true THEN 'legacy_external'
    WHEN om.user_id IS NOT NULL AND ps.user_id IS NOT NULL THEN 'team_member'
    ELSE NULL
  END
  FROM public.projects p
  LEFT JOIN public.project_shares ps
    ON ps.project_id = p.id AND ps.user_id = user_id_input
  LEFT JOIN public.organization_members om
    ON om.organization_id = p.organization_id
   AND om.user_id = user_id_input
   AND om.is_active = true
  WHERE p.id = project_id_input
    AND (user_id_input = auth.uid() OR current_user = 'service_role')
  LIMIT 1;
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
    public.effective_project_role(p.id, auth.uid()), ps.permission, ps.professional_role
  INTO project_status, project_demo, project_org, access_kind,
    share_permission, professional_role_value
  FROM public.projects p
  LEFT JOIN public.project_shares ps
    ON ps.project_id = p.id AND ps.user_id = auth.uid()
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
    IF access_kind = 'legacy_external' THEN RETURN false; END IF;
    IF professional_role_value IS NULL THEN
      RETURN public.user_has_feature('module_contracts')
        AND (action_input = 'view_contracts' OR share_permission = 'edit');
    END IF;
    contract_level := public.organization_role_permission_level(
      project_org, professional_role_value, 'contracts.records'
    );
    RETURN public.user_has_feature('module_contracts') AND CASE
      WHEN action_input = 'view_contracts' THEN contract_level IN ('read', 'write')
      ELSE contract_level = 'write'
    END;
  END IF;
  IF action_input = 'edit' THEN
    RETURN access_kind = 'system_owner'
      OR (access_kind = 'team_member' AND share_permission = 'edit')
      AND public.user_has_feature('module_projects');
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_project_module_action(
  project_id_input TEXT,
  feature_key_input TEXT,
  write_input BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN feature_key_input = 'module_contracts' THEN
      public.can_project_action(
        project_id_input,
        CASE WHEN write_input THEN 'edit_contracts' ELSE 'view_contracts' END
      )
    ELSE
      public.can_project_action(
        project_id_input,
        CASE WHEN write_input THEN 'edit' ELSE 'view' END
      ) AND public.user_has_feature(feature_key_input)
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
DECLARE member JSONB; member_id UUID; member_role TEXT;
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
    member_role := member->>'role';
    IF member_role NOT IN (
      'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
      'technician', 'contracts_department', 'economist'
    ) THEN RAISE EXCEPTION 'Invalid team member role'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id_input
        AND om.user_id = member_id AND om.is_active = true
    ) THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;
    INSERT INTO public.project_shares(
      project_id, user_id, role, professional_role, permission,
      legacy_external, created_by, updated_at
    ) VALUES (
      project_id_input, member_id, 'team_member', member_role,
      'edit', false, auth.uid(), now()
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      professional_role = EXCLUDED.professional_role,
      role = 'team_member', permission = 'edit', legacy_external = false,
      updated_at = now();
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
  user_id UUID,
  email TEXT,
  display_name TEXT,
  access_kind TEXT,
  professional_role TEXT,
  legacy_external BOOLEAN
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
      ps.professional_role, ps.legacy_external
    FROM public.project_shares ps
    JOIN auth.users au ON au.id = ps.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id
    WHERE ps.project_id = project_id_input AND ps.user_id = auth.uid();
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.owner_id, au.email::text, COALESCE(up.display_name, au.email)::text,
    'system_owner'::text, owner_share.professional_role, false
  FROM public.projects p
  JOIN auth.users au ON au.id = p.owner_id
  LEFT JOIN public.user_profiles up ON up.user_id = p.owner_id
  LEFT JOIN public.project_shares owner_share
    ON owner_share.project_id = p.id AND owner_share.user_id = p.owner_id
  WHERE p.id = project_id_input
  UNION ALL
  SELECT ps.user_id, au.email::text, COALESCE(up.display_name, au.email)::text,
    CASE WHEN ps.legacy_external THEN 'legacy_external' ELSE 'team_member' END,
    ps.professional_role, ps.legacy_external
  FROM public.project_shares ps
  JOIN public.projects p ON p.id = ps.project_id
  JOIN auth.users au ON au.id = ps.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id
  WHERE ps.project_id = project_id_input AND ps.user_id IS DISTINCT FROM p.owner_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_my_project_access();
CREATE FUNCTION public.get_my_project_access()
RETURNS TABLE(
  project_id TEXT,
  access_kind TEXT,
  professional_role TEXT,
  legacy_permission TEXT,
  project_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id::text, public.effective_project_role(p.id, auth.uid()),
    ps.professional_role, ps.permission::text, p.status::text
  FROM public.projects p
  LEFT JOIN public.project_shares ps
    ON ps.project_id = p.id AND ps.user_id = auth.uid()
  WHERE public.can_project_action(p.id, 'view');
$$;

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
  IF role_input NOT IN (
    'deputy', 'lead_site_manager', 'site_manager', 'preconstruction',
    'technician', 'contracts_department', 'economist'
  ) THEN RAISE EXCEPTION 'Invalid professional role'; END IF;
  SELECT organization_id INTO project_org FROM public.projects WHERE id = project_id_input;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = project_org
      AND om.user_id = user_id_input AND om.is_active = true
  ) THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;

  INSERT INTO public.project_shares(
    project_id, user_id, role, professional_role, permission,
    legacy_external, created_by, updated_at
  ) VALUES (
    project_id_input, user_id_input, 'team_member', role_input,
    'edit', false, auth.uid(), now()
  )
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = 'team_member', professional_role = EXCLUDED.professional_role,
    permission = 'edit', legacy_external = false, updated_at = now();

  INSERT INTO public.project_access_audit_events(
    organization_id, project_id, actor_user_id, target_user_id, event_type, metadata
  ) VALUES (
    project_org, project_id_input, auth.uid(), user_id_input,
    'team_member_set', jsonb_build_object('professional_role', role_input)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_project_team_member(
  project_id_input TEXT,
  user_id_input UUID
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
  DELETE FROM public.project_shares
  WHERE project_id = project_id_input AND user_id = user_id_input;
  INSERT INTO public.project_access_audit_events(
    organization_id, project_id, actor_user_id, target_user_id, event_type
  ) VALUES (
    project_org, project_id_input, auth.uid(), user_id_input, 'team_member_removed'
  );
END;
$$;

-- Preserve professional team assignments during ownership transfer.
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(
  project_id_input UUID,
  new_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_owner UUID;
  project_org UUID;
  project_is_demo BOOLEAN;
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Nepřihlášený uživatel'; END IF;
  SELECT p.owner_id, p.organization_id, COALESCE(p.is_demo, false)
    INTO current_owner, project_org, project_is_demo
  FROM public.projects p WHERE p.id = project_id_input::text FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projekt nebyl nalezen'; END IF;
  IF project_is_demo THEN RAISE EXCEPTION 'Demo projekt nelze předat jinému vlastníkovi'; END IF;
  IF current_owner IS DISTINCT FROM caller THEN RAISE EXCEPTION 'Pouze aktuální vlastník může předat stavbu'; END IF;
  IF new_owner_user_id = current_owner THEN RAISE EXCEPTION 'Nový vlastník je shodný s aktuálním'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = project_org
      AND om.user_id = new_owner_user_id AND om.is_active = true
  ) THEN RAISE EXCEPTION 'Nový vlastník není aktivním členem organizace stavby'; END IF;

  UPDATE public.projects SET owner_id = new_owner_user_id WHERE id = project_id_input::text;
  INSERT INTO public.project_access_audit_events(
    organization_id, project_id, actor_user_id, target_user_id, event_type,
    metadata
  ) VALUES (
    project_org, project_id_input::text, caller, new_owner_user_id,
    'project_ownership_transferred', jsonb_build_object('previous_owner_user_id', caller)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_role_permissions(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_organization_role_permission(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.organization_role_permission_level(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_project_team(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_project_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_confirmed_organization_role_permissions() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_organization_role_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_role_permission(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organization_role_permission_level(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_project_team(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_project_access() TO authenticated;

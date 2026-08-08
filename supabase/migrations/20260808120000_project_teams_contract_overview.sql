-- Project teams, archived-project write protection and organization contract overview.
-- Existing cross-organization shares are retained temporarily as read-only viewers.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

UPDATE public.projects
SET archived_at = COALESCE(archived_at, updated_at, created_at, now())
WHERE status = 'archived' AND archived_at IS NULL;

ALTER TABLE public.project_shares
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS legacy_external BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Same-organization editors become team members. External legacy shares lose write access.
UPDATE public.project_shares ps
SET role = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id = p.organization_id
         AND om.user_id = ps.user_id
         AND om.is_active = true
        WHERE p.id = ps.project_id
      ) THEN CASE WHEN ps.permission = 'edit' THEN 'team_member' ELSE 'viewer' END
      ELSE 'viewer'
    END,
    legacy_external = NOT EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om
        ON om.organization_id = p.organization_id
       AND om.user_id = ps.user_id
       AND om.is_active = true
      WHERE p.id = ps.project_id
    ),
    permission = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id = p.organization_id
         AND om.user_id = ps.user_id
         AND om.is_active = true
        WHERE p.id = ps.project_id
      ) AND ps.permission = 'edit' THEN 'edit'
      ELSE 'view'
    END
WHERE ps.role IS NULL;

ALTER TABLE public.project_shares ALTER COLUMN role SET DEFAULT 'team_member';
ALTER TABLE public.project_shares ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.project_shares DROP CONSTRAINT IF EXISTS project_shares_role_check;
ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_role_check
  CHECK (role IN ('project_admin', 'project_manager', 'team_member', 'viewer'));
CREATE INDEX IF NOT EXISTS idx_project_shares_user_project_role
  ON public.project_shares(user_id, project_id, role);

INSERT INTO public.permission_definitions (key, label, description, category, sort_order)
VALUES (
  'contract_overview_access',
  'Přístup ke smluvnímu přehledu',
  'Povoluje auditovaný read-only přehled omezených smluvních údajů napříč stavbami organizace.',
  'organization',
  500
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS public.organization_member_permissions (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permission_definitions(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, permission_key),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.project_access_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_id VARCHAR(36) REFERENCES public.projects(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'project_created', 'team_member_set', 'team_member_removed',
    'project_archived', 'project_restored', 'contract_overview_access',
    'contract_overview_permission_set'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_access_audit_org_created
  ON public.project_access_audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_access_audit_project_created
  ON public.project_access_audit_events(project_id, created_at DESC);

ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_access_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_member_permissions FROM anon, authenticated;
REVOKE ALL ON public.project_access_audit_events FROM anon, authenticated;
GRANT SELECT ON public.organization_member_permissions TO authenticated;
GRANT SELECT ON public.project_access_audit_events TO authenticated;
GRANT ALL ON public.organization_member_permissions TO service_role;
GRANT ALL ON public.project_access_audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.purge_automatic_contract_overview_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IN ('owner', 'admin') THEN
    DELETE FROM public.organization_member_permissions
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.user_id
      AND permission_key = 'contract_overview_access';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_purge_automatic_contract_overview_permission ON public.organization_members;
CREATE TRIGGER trg_purge_automatic_contract_overview_permission
  AFTER INSERT OR UPDATE OF role ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.purge_automatic_contract_overview_permission();

CREATE OR REPLACE FUNCTION public.remove_departed_member_project_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.project_shares ps
  USING public.projects p
  WHERE p.id = ps.project_id
    AND p.organization_id = OLD.organization_id
    AND ps.user_id = OLD.user_id
    AND ps.legacy_external = false;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_remove_departed_member_project_access ON public.organization_members;
CREATE TRIGGER trg_remove_departed_member_project_access
  AFTER DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.remove_departed_member_project_access();

CREATE OR REPLACE FUNCTION public.is_active_org_admin_or_owner(org_id UUID, user_id_input UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = user_id_input
      AND (user_id_input = auth.uid() OR auth.role() = 'service_role')
      AND om.is_active = true
      AND om.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.effective_project_role(project_id_input TEXT, user_id_input UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p.owner_id = user_id_input
      AND (p.organization_id IS NULL OR om.user_id IS NOT NULL) THEN 'owner_admin'
    WHEN ps.legacy_external = true THEN 'viewer'
    WHEN om.user_id IS NOT NULL THEN ps.role
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
    AND (user_id_input = auth.uid() OR auth.role() = 'service_role')
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
  effective_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT p.status, COALESCE(p.is_demo, false), public.effective_project_role(p.id, auth.uid())
    INTO project_status, project_demo, effective_role
  FROM public.projects p WHERE p.id = project_id_input;
  IF NOT FOUND THEN RETURN false; END IF;

  IF project_demo AND action_input = 'view' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM public.user_hidden_projects uhp
      WHERE uhp.project_id = project_id_input AND uhp.user_id = auth.uid()
    );
  END IF;
  IF effective_role IS NULL THEN RETURN false; END IF;
  IF action_input = 'view' THEN RETURN true; END IF;
  IF project_status = 'archived' THEN
    RETURN action_input = 'restore' AND effective_role IN ('owner_admin', 'project_admin');
  END IF;
  IF action_input IN ('manage_team', 'archive') THEN
    RETURN effective_role IN ('owner_admin', 'project_admin');
  END IF;
  IF action_input = 'delete' THEN RETURN effective_role = 'owner_admin'; END IF;
  IF action_input = 'edit_contracts' THEN
    RETURN effective_role IN ('owner_admin', 'project_admin', 'project_manager', 'team_member')
      AND public.user_has_feature('module_contracts');
  END IF;
  IF action_input = 'edit' THEN
    RETURN effective_role IN ('owner_admin', 'project_admin', 'project_manager', 'team_member')
      AND public.user_has_feature('module_projects');
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_project_shared_with_user(p_id TEXT, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.effective_project_role(p_id, u_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.has_project_share_permission(p_id TEXT, u_id UUID, required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN required_permission = 'view' THEN public.effective_project_role(p_id, u_id) IS NOT NULL
    WHEN required_permission = 'edit' THEN
      (SELECT status <> 'archived' FROM public.projects WHERE id = p_id)
      AND public.effective_project_role(p_id, u_id) IN ('project_admin', 'project_manager', 'team_member')
      AND public.user_has_feature('module_projects')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_contract_overview_access(org_id_input UUID, user_id_input UUID DEFAULT auth.uid())
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
      AND (user_id_input = auth.uid() OR auth.role() = 'service_role')
      AND om.is_active = true
      AND (
        om.role IN ('owner', 'admin')
        OR (
          om.role = 'member'
          AND EXISTS (
            SELECT 1 FROM public.organization_member_permissions omp
            WHERE omp.organization_id = om.organization_id
              AND omp.user_id = om.user_id
              AND omp.permission_key = 'contract_overview_access'
              AND omp.enabled = true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_project_module_action(project_id_input TEXT, feature_key_input TEXT, write_input BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.can_project_action(project_id_input, CASE WHEN write_input THEN 'edit' ELSE 'view' END)
    AND public.user_has_feature(feature_key_input);
$$;

DROP POLICY IF EXISTS "organization permissions visible" ON public.organization_member_permissions;
CREATE POLICY "organization permissions visible" ON public.organization_member_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_active_org_admin_or_owner(organization_id)
  );

DROP POLICY IF EXISTS "organization audit visible to administrators" ON public.project_access_audit_events;
CREATE POLICY "organization audit visible to administrators" ON public.project_access_audit_events
  FOR SELECT TO authenticated
  USING (public.is_active_org_admin_or_owner(organization_id));

-- Replace project/share policies so roles are authoritative and direct team writes are impossible.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', policy_row.policyname); END LOOP;
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_shares'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_shares', policy_row.policyname); END LOOP;
END $$;

CREATE POLICY "projects role select" ON public.projects FOR SELECT TO authenticated
  USING (public.can_project_action(id, 'view'));
CREATE POLICY "projects rpc insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND public.can_create_project()
    AND (organization_id IS NULL OR public.is_org_member(organization_id))
  );
CREATE POLICY "projects role update" ON public.projects FOR UPDATE TO authenticated
  USING (public.can_project_action(id, 'edit'))
  WITH CHECK (public.can_project_action(id, 'edit'));
CREATE POLICY "projects owner delete" ON public.projects FOR DELETE TO authenticated
  USING (public.can_project_action(id, 'delete'));
CREATE POLICY "project team select" ON public.project_shares FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_project_action(project_id, 'manage_team'));

REVOKE INSERT, UPDATE, DELETE ON public.project_shares FROM authenticated;
GRANT SELECT ON public.project_shares TO authenticated;

ALTER TABLE public.bid_tags ENABLE ROW LEVEL SECURITY;

-- Restrictive policies close historical org-wide branches: project membership AND module entitlement are required.
DO $$
DECLARE spec TEXT[]; relation_name TEXT; project_column TEXT; feature_key TEXT; policy_prefix TEXT;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ['demand_categories','project_id','module_pipeline'], ['tender_plans','project_id','module_pipeline'],
    ['contracts','project_id','module_contracts'], ['project_contracts','project_id','module_projects'],
    ['contract_markdown_versions','project_id','module_contracts'],
    ['project_investor_financials','project_id','module_projects'], ['project_investor_invoices','project_id','module_projects'],
    ['project_amendments','project_id','module_projects'], ['project_internal_amendments','project_id','module_projects']
  ]::TEXT[][] LOOP
    relation_name := spec[1]; project_column := spec[2]; feature_key := spec[3]; policy_prefix := 'team_module_' || relation_name;
    IF to_regclass('public.' || relation_name) IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=relation_name AND column_name=project_column) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_select', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_project_module_action(%I::text, %L, false))', policy_prefix || '_select', relation_name, project_column, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_insert', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_project_module_action(%I::text, %L, true))', policy_prefix || '_insert', relation_name, project_column, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_update', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_project_module_action(%I::text, %L, true)) WITH CHECK (public.can_project_module_action(%I::text, %L, true))', policy_prefix || '_update', relation_name, project_column, feature_key, project_column, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_delete', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_project_module_action(%I::text, %L, true))', policy_prefix || '_delete', relation_name, project_column, feature_key);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE spec TEXT[]; relation_name TEXT; parent_kind TEXT; parent_column TEXT; feature_key TEXT; project_expression TEXT; policy_prefix TEXT;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ['bids','category','demand_category_id','module_pipeline'],
    ['bid_tags','bid','bid_id','module_pipeline'],
    ['contract_amendments','contract','contract_id','module_contracts'],
    ['contract_drawdowns','contract','contract_id','module_contracts'],
    ['contract_invoices','contract','contract_id','module_contracts']
  ]::TEXT[][] LOOP
    relation_name := spec[1]; parent_kind := spec[2]; parent_column := spec[3]; feature_key := spec[4]; policy_prefix := 'team_module_' || relation_name;
    IF relation_name = 'bids' THEN
      SELECT column_name INTO parent_column FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bids'
        AND column_name IN ('demand_category_id', 'category_id')
      ORDER BY CASE column_name WHEN 'demand_category_id' THEN 0 ELSE 1 END LIMIT 1;
    END IF;
    IF to_regclass('public.' || relation_name) IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=relation_name AND column_name=parent_column) THEN
      project_expression := CASE parent_kind
        WHEN 'category' THEN format('(SELECT dc.project_id FROM public.demand_categories dc WHERE dc.id::text = %I::text)', parent_column)
        WHEN 'bid' THEN format('(SELECT dc.project_id FROM public.bids b JOIN public.demand_categories dc ON dc.id::text = COALESCE(to_jsonb(b)->>''demand_category_id'', to_jsonb(b)->>''category_id'') WHERE b.id::text = %I::text)', parent_column)
        ELSE format('(SELECT c.project_id FROM public.contracts c WHERE c.id = %I)', parent_column)
      END;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_select', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_project_module_action(%s, %L, false))', policy_prefix || '_select', relation_name, project_expression, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_insert', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_project_module_action(%s, %L, true))', policy_prefix || '_insert', relation_name, project_expression, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_update', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_project_module_action(%s, %L, true)) WITH CHECK (public.can_project_module_action(%s, %L, true))', policy_prefix || '_update', relation_name, project_expression, feature_key, project_expression, feature_key);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_delete', relation_name);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_project_module_action(%s, %L, true))', policy_prefix || '_delete', relation_name, project_expression, feature_key);
    END IF;
  END LOOP;
END $$;

-- Storage access follows the same project role, module and archived-state checks as database rows.
DROP POLICY IF EXISTS "contract_documents_select" ON storage.objects;
CREATE POLICY "contract_documents_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND public.can_project_module_action(split_part(name, '/', 2), 'module_contracts', false)
);

DROP POLICY IF EXISTS "contract_documents_insert" ON storage.objects;
CREATE POLICY "contract_documents_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND split_part(name, '/', 4) ~ '^[A-Za-z0-9-]+\.(pdf|docx)$'
  AND public.can_project_module_action(split_part(name, '/', 2), 'module_contracts', true)
);

DROP POLICY IF EXISTS "contract_documents_delete" ON storage.objects;
CREATE POLICY "contract_documents_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND public.can_project_module_action(split_part(name, '/', 2), 'module_contracts', true)
);

CREATE OR REPLACE FUNCTION public.guard_project_identity_and_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF current_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'Project ownership and organization can only be changed by a controlled RPC';
    END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'archived' OR OLD.status = 'archived') THEN
    IF current_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'Project archive state can only be changed by a controlled RPC';
    END IF;
  END IF;
  IF OLD.status = 'archived' AND NEW.status = 'archived' AND to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    RAISE EXCEPTION 'Project is archived';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_project_identity_and_archive ON public.projects;
CREATE TRIGGER trg_guard_project_identity_and_archive
  BEFORE UPDATE ON public.projects FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_identity_and_archive();

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
    WHERE om.organization_id = organization_id_input AND om.user_id = auth.uid() AND om.is_active = true
  ) THEN RAISE EXCEPTION 'Active organization membership required'; END IF;

  INSERT INTO public.projects(id, name, location, status, owner_id, organization_id)
  VALUES (project_id_input, btrim(name_input), btrim(COALESCE(location_input, '')), status_input, auth.uid(), organization_id_input);

  FOR member IN SELECT value FROM jsonb_array_elements(COALESCE(team_input, '[]'::jsonb)) LOOP
    member_id := (member->>'user_id')::uuid;
    member_role := member->>'role';
    IF member_id = auth.uid() OR member_role NOT IN ('project_admin', 'project_manager', 'team_member', 'viewer') THEN
      RAISE EXCEPTION 'Invalid team member';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id_input AND om.user_id = member_id AND om.is_active = true
    ) THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;
    INSERT INTO public.project_shares(project_id, user_id, role, permission, legacy_external, created_by)
    VALUES (project_id_input, member_id, member_role,
      CASE WHEN member_role = 'viewer' THEN 'view' ELSE 'edit' END, false, auth.uid());
  END LOOP;

  INSERT INTO public.project_access_audit_events(organization_id, project_id, actor_user_id, event_type, metadata)
  VALUES (organization_id_input, project_id_input, auth.uid(), 'project_created', jsonb_build_object('team_size', jsonb_array_length(COALESCE(team_input, '[]'::jsonb))));
  RETURN project_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_project_team(project_id_input TEXT)
RETURNS TABLE(user_id UUID, email TEXT, display_name TEXT, role TEXT, legacy_external BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_project_action(project_id_input, 'view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.can_project_action(project_id_input, 'manage_team') THEN
    RETURN QUERY
    SELECT ps.user_id, au.email::text, COALESCE(up.display_name, au.email)::text, ps.role, ps.legacy_external
    FROM public.project_shares ps JOIN auth.users au ON au.id = ps.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id
    WHERE ps.project_id = project_id_input AND ps.user_id = auth.uid();
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.owner_id, au.email::text, COALESCE(up.display_name, au.email)::text, 'owner_admin'::text, false
  FROM public.projects p JOIN auth.users au ON au.id = p.owner_id
  LEFT JOIN public.user_profiles up ON up.user_id = p.owner_id WHERE p.id = project_id_input
  UNION ALL
  SELECT ps.user_id, au.email::text, COALESCE(up.display_name, au.email)::text, ps.role, ps.legacy_external
  FROM public.project_shares ps JOIN auth.users au ON au.id = ps.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = ps.user_id WHERE ps.project_id = project_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_projects_metadata()
RETURNS TABLE(project_id VARCHAR(255), owner_email VARCHAR(255), shared_with_emails TEXT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id::VARCHAR(255), owner_u.email::VARCHAR(255),
    CASE WHEN public.can_project_action(p.id, 'manage_team') THEN
      ARRAY(SELECT shared_u.email::text FROM public.project_shares ps JOIN auth.users shared_u ON shared_u.id = ps.user_id WHERE ps.project_id = p.id ORDER BY shared_u.email)
    ELSE ARRAY[(SELECT current_u.email::text FROM auth.users current_u WHERE current_u.id = auth.uid())] END
  FROM public.projects p
  LEFT JOIN auth.users owner_u ON owner_u.id = p.owner_id
  WHERE public.can_project_action(p.id, 'view');
$$;

CREATE OR REPLACE FUNCTION public.get_my_project_access()
RETURNS TABLE(project_id TEXT, project_role TEXT, project_status TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id::text, public.effective_project_role(p.id, auth.uid()), p.status::text
  FROM public.projects p
  WHERE public.can_project_action(p.id, 'view');
$$;

CREATE OR REPLACE FUNCTION public.set_project_team_member(project_id_input TEXT, user_id_input UUID, role_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE project_org UUID; project_owner UUID;
BEGIN
  PERFORM 1 FROM public.projects WHERE id = project_id_input FOR UPDATE;
  IF NOT public.can_project_action(project_id_input, 'manage_team') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF role_input NOT IN ('project_admin', 'project_manager', 'team_member', 'viewer') THEN RAISE EXCEPTION 'Invalid project role'; END IF;
  SELECT organization_id, owner_id INTO project_org, project_owner FROM public.projects WHERE id = project_id_input;
  IF user_id_input = project_owner THEN RAISE EXCEPTION 'Project owner role is automatic'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = project_org AND om.user_id = user_id_input AND om.is_active = true)
    THEN RAISE EXCEPTION 'Team members must be active members of the project organization'; END IF;
  INSERT INTO public.project_shares(project_id, user_id, role, permission, legacy_external, created_by, updated_at)
  VALUES (project_id_input, user_id_input, role_input, CASE WHEN role_input = 'viewer' THEN 'view' ELSE 'edit' END, false, auth.uid(), now())
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, permission = EXCLUDED.permission,
    legacy_external = false, updated_at = now();
  INSERT INTO public.project_access_audit_events(organization_id, project_id, actor_user_id, target_user_id, event_type, metadata)
  VALUES (project_org, project_id_input, auth.uid(), user_id_input, 'team_member_set', jsonb_build_object('role', role_input));
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_project_team_member(project_id_input TEXT, user_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE project_org UUID; project_owner UUID;
BEGIN
  PERFORM 1 FROM public.projects WHERE id = project_id_input FOR UPDATE;
  IF NOT public.can_project_action(project_id_input, 'manage_team') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT organization_id, owner_id INTO project_org, project_owner FROM public.projects WHERE id = project_id_input;
  IF user_id_input = project_owner THEN RAISE EXCEPTION 'Project owner cannot be removed'; END IF;
  DELETE FROM public.project_shares WHERE project_id = project_id_input AND user_id = user_id_input;
  INSERT INTO public.project_access_audit_events(organization_id, project_id, actor_user_id, target_user_id, event_type)
  VALUES (project_org, project_id_input, auth.uid(), user_id_input, 'team_member_removed');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_archived(project_id_input TEXT, archived_input BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE project_org UUID; old_status TEXT; restored_status TEXT;
BEGIN
  SELECT organization_id, status, COALESCE(archived_original_status, 'realization')
    INTO project_org, old_status, restored_status FROM public.projects WHERE id = project_id_input FOR UPDATE;
  IF archived_input THEN
    IF NOT public.can_project_action(project_id_input, 'archive') THEN RAISE EXCEPTION 'Not authorized'; END IF;
    IF old_status = 'archived' THEN RETURN; END IF;
    UPDATE public.projects SET archived_original_status = old_status, status = 'archived', archived_at = now(), archived_by = auth.uid() WHERE id = project_id_input;
  ELSE
    IF NOT public.can_project_action(project_id_input, 'restore') THEN RAISE EXCEPTION 'Not authorized'; END IF;
    UPDATE public.projects SET status = restored_status, archived_original_status = NULL, archived_at = NULL, archived_by = NULL WHERE id = project_id_input;
  END IF;
  INSERT INTO public.project_access_audit_events(organization_id, project_id, actor_user_id, event_type)
  VALUES (project_org, project_id_input, auth.uid(), CASE WHEN archived_input THEN 'project_archived' ELSE 'project_restored' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contract_overview_permission(org_id_input UUID, user_id_input UUID, enabled_input BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE target_role TEXT;
BEGIN
  IF NOT public.is_active_org_admin_or_owner(org_id_input) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT om.role INTO target_role FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input AND om.is_active = true FOR UPDATE;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Active organization member required'; END IF;
  IF target_role <> 'member' THEN RAISE EXCEPTION 'Automatic permission cannot be changed for organization owner or admin'; END IF;
  INSERT INTO public.organization_member_permissions(organization_id, user_id, permission_key, enabled, granted_by, granted_at, updated_at)
  VALUES (org_id_input, user_id_input, 'contract_overview_access', enabled_input, auth.uid(), now(), now())
  ON CONFLICT (organization_id, user_id, permission_key) DO UPDATE SET enabled = EXCLUDED.enabled, granted_by = auth.uid(), updated_at = now();
  INSERT INTO public.project_access_audit_events(organization_id, actor_user_id, target_user_id, event_type, metadata)
  VALUES (org_id_input, auth.uid(), user_id_input, 'contract_overview_permission_set', jsonb_build_object('enabled', enabled_input));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_organization_contract_overview_permissions(org_id_input UUID)
RETURNS TABLE(user_id UUID, access_enabled BOOLEAN, access_source TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_org_member(org_id_input) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT om.user_id,
    CASE WHEN om.role IN ('owner', 'admin') THEN true ELSE COALESCE(omp.enabled, false) END,
    CASE WHEN om.role IN ('owner', 'admin') THEN 'automatic' ELSE 'explicit' END::text
  FROM public.organization_members om
  LEFT JOIN public.organization_member_permissions omp ON omp.organization_id = om.organization_id
    AND omp.user_id = om.user_id AND omp.permission_key = 'contract_overview_access'
  WHERE om.organization_id = org_id_input AND om.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_contract_overview_access(org_id_input UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT public.has_contract_overview_access(org_id_input, auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.get_contract_overview(organization_id_input UUID DEFAULT NULL, include_archived BOOLEAN DEFAULT false)
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
DECLARE caller_org UUID; result_count INTEGER;
BEGIN
  caller_org := organization_id_input;
  IF caller_org IS NULL THEN
    SELECT om.organization_id INTO caller_org FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
      AND public.has_contract_overview_access(om.organization_id, auth.uid())
    ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1;
  END IF;
  IF caller_org IS NOT NULL AND NOT public.has_contract_overview_access(caller_org, auth.uid()) THEN
    RAISE EXCEPTION 'Přístup ke smluvnímu přehledu nebyl udělen';
  END IF;
  IF caller_org IS NULL THEN RAISE EXCEPTION 'Přístup ke smluvnímu přehledu nebyl udělen'; END IF;

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
  LEFT JOIN (SELECT ca.contract_id, SUM(ca.delta_price) amendments_total FROM public.contract_amendments ca GROUP BY ca.contract_id) a ON a.contract_id = c.id
  LEFT JOIN (SELECT cd.contract_id, SUM(cd.approved_amount) approved_total FROM public.contract_drawdowns cd GROUP BY cd.contract_id) d ON d.contract_id = c.id
  WHERE include_archived OR p.status <> 'archived'
  ORDER BY p.name, c.vendor_name, c.title;
  GET DIAGNOSTICS result_count = ROW_COUNT;
  INSERT INTO public.project_access_audit_events(organization_id, actor_user_id, event_type, metadata)
  VALUES (caller_org, auth.uid(), 'contract_overview_access', jsonb_build_object('include_archived', include_archived, 'result_count', result_count));
END;
$$;

-- Generic guard; trigger argument is a lookup kind: direct column, contract, category, or bid.
CREATE OR REPLACE FUNCTION public.guard_archived_project_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE row_data JSONB; affected_project TEXT; old_data JSONB; old_project TEXT;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_ARGV[0] = 'contract' THEN
    SELECT c.project_id INTO affected_project FROM public.contracts c WHERE c.id = (row_data->>TG_ARGV[1])::uuid;
  ELSIF TG_ARGV[0] = 'category' THEN
    SELECT dc.project_id INTO affected_project FROM public.demand_categories dc WHERE dc.id = row_data->>TG_ARGV[1];
  ELSIF TG_ARGV[0] = 'bid' THEN
    SELECT dc.project_id INTO affected_project
    FROM public.bids b
    JOIN public.demand_categories dc
      ON dc.id::text = COALESCE(to_jsonb(b)->>'demand_category_id', to_jsonb(b)->>'category_id')
    WHERE b.id::text = row_data->>TG_ARGV[1];
  ELSE
    affected_project := row_data->>TG_ARGV[1];
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = affected_project AND p.status = 'archived') THEN
    RAISE EXCEPTION 'Project is archived';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    IF TG_ARGV[0] = 'contract' THEN
      SELECT c.project_id INTO old_project FROM public.contracts c WHERE c.id = (old_data->>TG_ARGV[1])::uuid;
    ELSIF TG_ARGV[0] = 'category' THEN
      SELECT dc.project_id INTO old_project FROM public.demand_categories dc WHERE dc.id = old_data->>TG_ARGV[1];
    ELSIF TG_ARGV[0] = 'bid' THEN
      SELECT dc.project_id INTO old_project
      FROM public.bids b
      JOIN public.demand_categories dc
        ON dc.id::text = COALESCE(to_jsonb(b)->>'demand_category_id', to_jsonb(b)->>'category_id')
      WHERE b.id::text = old_data->>TG_ARGV[1];
    ELSE
      old_project := old_data->>TG_ARGV[1];
    END IF;
    IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = old_project AND p.status = 'archived') THEN
      RAISE EXCEPTION 'Project is archived';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE spec TEXT[]; relation_name TEXT; lookup_kind TEXT; key_column TEXT; trigger_name TEXT;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ['demand_categories','direct','project_id'], ['tender_plans','direct','project_id'],
    ['contracts','direct','project_id'], ['project_contracts','direct','project_id'],
    ['contract_markdown_versions','direct','project_id'],
    ['project_investor_financials','direct','project_id'], ['project_investor_invoices','direct','project_id'],
    ['project_amendments','direct','project_id'], ['project_internal_amendments','direct','project_id'],
    ['tasks','direct','project_id'], ['templates','direct','project_id'],
    ['dochub_project_folders','direct','project_id'], ['dochub_project_connections','direct','project_id'],
    ['dochub_autocreate_runs','direct','project_id'],
    ['contract_amendments','contract','contract_id'],
    ['contract_drawdowns','contract','contract_id'], ['contract_invoices','contract','contract_id'],
    ['bid_tags','bid','bid_id']
  ]::TEXT[][] LOOP
    relation_name := spec[1]; lookup_kind := spec[2]; key_column := spec[3];
    IF to_regclass('public.' || relation_name) IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=relation_name AND column_name=key_column) THEN
      trigger_name := 'trg_archived_guard_' || relation_name;
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, relation_name);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_archived_project_write(%L, %L)', trigger_name, relation_name, lookup_kind, key_column);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE bid_category_column TEXT;
BEGIN
  IF to_regclass('public.bids') IS NULL THEN RETURN; END IF;
  SELECT column_name INTO bid_category_column FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bids'
    AND column_name IN ('demand_category_id', 'category_id')
  ORDER BY CASE column_name WHEN 'demand_category_id' THEN 0 ELSE 1 END LIMIT 1;
  IF bid_category_column IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_archived_guard_bids ON public.bids;
    EXECUTE format('CREATE TRIGGER trg_archived_guard_bids BEFORE INSERT OR UPDATE OR DELETE ON public.bids FOR EACH ROW EXECUTE FUNCTION public.guard_archived_project_write(%L, %L)', 'category', bid_category_column);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.is_active_org_admin_or_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effective_project_role(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_project_action(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_contract_overview_access(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_project_module_action(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_project_with_team(TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_project_team(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_project_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_project_team_member(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_project_team_member(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_project_archived(TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_contract_overview_permission(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_organization_contract_overview_permissions(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_contract_overview_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_automatic_contract_overview_permission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_departed_member_project_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_project_shares_debug(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_project_shares(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_project_shares_v2(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_org_admin_or_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_project_role(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_project_action(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_contract_overview_access(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_project_module_action(TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_with_team(TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_team(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_project_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_team_member(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_project_team_member(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_archived(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_contract_overview_permission(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_contract_overview_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contract_overview_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_overview(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_metadata() TO authenticated;

-- Migration: harden_tenant_isolation_writes
-- Date: 2026-05-11
-- Description: Harden tenant isolation for org join RPCs, project tenant updates, and subcontractor writes.

-- ============================================================================
-- 1. Organization join request RPC hardening
-- ============================================================================

CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain TEXT;
  target_org UUID;
  normalized_email TEXT;
  auth_user_email TEXT;
BEGIN
  -- This helper is intended for auth.users trigger execution or trusted backend code.
  -- Direct client calls must use request_org_join_by_email(), which derives identity from auth.uid().
  IF COALESCE(auth.role(), '') <> 'service_role' AND pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  normalized_email := lower(trim(email_input));
  IF user_id_input IS NULL OR normalized_email IS NULL OR normalized_email = '' THEN
    RETURN;
  END IF;

  SELECT lower(trim(u.email))
  INTO auth_user_email
  FROM auth.users u
  WHERE u.id = user_id_input;

  IF auth_user_email IS NULL OR auth_user_email <> normalized_email THEN
    RETURN;
  END IF;

  domain := public.normalize_email_domain(normalized_email);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RETURN;
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org
      AND om.user_id = user_id_input
      AND COALESCE(om.is_active, true) = true
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, user_id_input, normalized_email)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) TO service_role;

-- ============================================================================
-- 2. Project organization update guard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_update_project_organization(
  project_id_input TEXT,
  organization_id_input UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  current_org_id UUID;
BEGIN
  SELECT p.organization_id
  INTO current_org_id
  FROM public.projects p
  WHERE p.id = project_id_input;

  IF FOUND AND current_org_id IS NOT DISTINCT FROM organization_id_input THEN
    RETURN TRUE;
  END IF;

  RETURN organization_id_input IS NOT NULL
    AND public.is_org_member(organization_id_input);
END;
$$;

REVOKE ALL ON FUNCTION public.can_update_project_organization(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_update_project_organization(TEXT, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Projects update for owner or shared editor" ON public.projects;
DROP POLICY IF EXISTS "Projects update for owner, org member, or shared editor" ON public.projects;

CREATE POLICY "Projects update for owner or shared editor"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_project_share_permission(id, auth.uid(), 'edit')
)
WITH CHECK (
  (
    owner_id = auth.uid()
    OR public.has_project_share_permission(id, auth.uid(), 'edit')
  )
  AND public.can_update_project_organization(id, organization_id)
);

-- ============================================================================
-- 3. Subcontractor organization and owner consistency
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_write_subcontractor_tenant(
  owner_id_input UUID,
  organization_id_input UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF owner_id_input IS NULL THEN
    RETURN FALSE;
  END IF;

  IF organization_id_input IS NULL THEN
    RETURN owner_id_input = auth.uid();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members caller
    WHERE caller.organization_id = organization_id_input
      AND caller.user_id = auth.uid()
      AND COALESCE(caller.is_active, true) = true
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members owner_member
    WHERE owner_member.organization_id = organization_id_input
      AND owner_member.user_id = owner_id_input
      AND COALESCE(owner_member.is_active, true) = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_write_subcontractor_tenant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_subcontractor_tenant(UUID, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Subcontractors insert restricted to owner or org" ON public.subcontractors;
DROP POLICY IF EXISTS "Manage own or org subcontractors" ON public.subcontractors;

CREATE POLICY "Subcontractors insert restricted to owner or org"
ON public.subcontractors
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_write_subcontractor_tenant(owner_id, organization_id)
);

CREATE POLICY "Manage own or org subcontractors"
ON public.subcontractors
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
)
WITH CHECK (
  public.can_write_subcontractor_tenant(owner_id, organization_id)
);

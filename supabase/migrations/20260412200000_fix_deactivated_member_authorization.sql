-- Migration: fix_deactivated_member_authorization
-- Date: 2026-04-12
-- Description: Prevent deactivated org members from passing member authorization checks.

-- Ensure core membership helper excludes deactivated users.
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  );
$$;

-- Ensure org list helper only returns active memberships.
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
    ),
    ARRAY[]::uuid[]
  );
$$;

-- Ensure get_org_members only allows active members.
CREATE OR REPLACE FUNCTION public.get_org_members(org_id_input UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = auth.uid()
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT q.user_id, q.email, q.display_name, q.role, q.joined_at, q.is_active
  FROM (
    SELECT DISTINCT ON (om.user_id)
      om.user_id::UUID AS user_id,
      u.email::TEXT AS email,
      up.display_name::TEXT AS display_name,
      om.role::TEXT AS role,
      om.created_at::TIMESTAMPTZ AS joined_at,
      om.is_active::BOOLEAN AS is_active
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE om.organization_id = org_id_input
    ORDER BY om.user_id, om.created_at ASC
  ) AS q
  ORDER BY q.joined_at;
END;
$$;

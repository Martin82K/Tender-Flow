-- Migration: fix_org_members_rls
-- Date: 2026-01-02
-- Description: Fixes infinite recursion in RLS policy for organization_members by using SECURITY DEFINER helpers.

-- 1) Replace helper functions to bypass RLS safely (auth.uid()-scoped)
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
  );
$$;

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
    ),
    ARRAY[]::uuid[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_ids() TO authenticated;

-- 2) Organizations: visible if member (avoid recursive subquery paths)
DROP POLICY IF EXISTS "Organizations visible to members" ON public.organizations;
CREATE POLICY "Organizations visible to members" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

-- 3) Org Members: visible to members of same org (no self-referencing subquery)
DROP POLICY IF EXISTS "Member list visible to members" ON public.organization_members;
CREATE POLICY "Member list visible to members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));


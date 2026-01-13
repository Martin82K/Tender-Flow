-- Migration: fix_contact_statuses_rls
-- Date: 2026-01-05
-- Description: Updates subcontractor_statuses RLS to use get_my_org_ids() helper
-- to avoid recursion and improve performance.

-- Ensure get_my_org_ids is robust (idempotent re-definition from previous migration fix)
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

GRANT EXECUTE ON FUNCTION public.get_my_org_ids() TO authenticated;

-- Update Policies

DROP POLICY IF EXISTS "subcontractor_statuses_tenant_select" ON public.subcontractor_statuses;
CREATE POLICY "subcontractor_statuses_tenant_select" ON public.subcontractor_statuses
    FOR SELECT
    TO authenticated
    USING (
        organization_id IS NULL 
        OR organization_id = ANY(public.get_my_org_ids())
    );

DROP POLICY IF EXISTS "subcontractor_statuses_tenant_insert" ON public.subcontractor_statuses;
CREATE POLICY "subcontractor_statuses_tenant_insert" ON public.subcontractor_statuses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id = ANY(public.get_my_org_ids())
    );

DROP POLICY IF EXISTS "subcontractor_statuses_tenant_update" ON public.subcontractor_statuses;
CREATE POLICY "subcontractor_statuses_tenant_update" ON public.subcontractor_statuses
    FOR UPDATE
    TO authenticated
    USING (
        organization_id = ANY(public.get_my_org_ids())
    );

DROP POLICY IF EXISTS "subcontractor_statuses_tenant_delete" ON public.subcontractor_statuses;
CREATE POLICY "subcontractor_statuses_tenant_delete" ON public.subcontractor_statuses
    FOR DELETE
    TO authenticated
    USING (
        organization_id = ANY(public.get_my_org_ids())
    );

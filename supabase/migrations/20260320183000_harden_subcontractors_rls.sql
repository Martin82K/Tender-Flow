-- Migration: harden_subcontractors_rls
-- Date: 2026-03-20
-- Description: Keeps subcontractors shared within the tenant, but removes public / NULL-owner exposure.

DROP POLICY IF EXISTS "Users can view own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Subcontractors visible to owner or org" ON public.subcontractors;
DROP POLICY IF EXISTS "Subcontractors insert restricted to owner or org" ON public.subcontractors;
DROP POLICY IF EXISTS "Manage own or org subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Visibility" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Update" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Delete" ON public.subcontractors;
DROP POLICY IF EXISTS "Users can update own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Users can delete own or public subcontractors" ON public.subcontractors;

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcontractors visible to owner or org"
ON public.subcontractors
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
);

CREATE POLICY "Subcontractors insert restricted to owner or org"
ON public.subcontractors
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
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
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
);

CREATE POLICY "Strict Subcontractor Delete"
ON public.subcontractors
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
);

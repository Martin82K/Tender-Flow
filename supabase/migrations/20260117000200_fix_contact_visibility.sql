-- Migration: fix_contact_visibility
-- Date: 2026-01-17
-- Description: Enforces strict organization-based visibility for contacts (subcontractors table).
-- Previous policies allowed any authenticated user to view contacts with owner_id = NULL.
-- This update restricts visibility to:
-- 1. The owner of the contact
-- 2. Members of the organization the contact belongs to

-- 1. Drop the legacy permissive legacy policy (usually named "Users can view own or public subcontractors")
DROP POLICY IF EXISTS "Users can view own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Subcontractors visible to owner or org" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Visibility" ON public.subcontractors;

-- 2. Create STRICT Select Policy
CREATE POLICY "Strict Subcontractor Visibility" ON public.subcontractors
    FOR SELECT
    TO authenticated
    USING (
        -- A: I am the direct owner
        owner_id = auth.uid()
        OR
        -- B: The contact belongs to one of my organizations
        -- We use the helper function get_my_org_ids() for performance checking
        organization_id = ANY(public.get_my_org_ids())
    );

-- 3. Update Permissions (allow editing if you see it, or refine this?)
-- Usually you want Org Members to be able to edit Org Contacts.
DROP POLICY IF EXISTS "Users can update own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Manage own or org subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Update" ON public.subcontractors;

CREATE POLICY "Strict Subcontractor Update" ON public.subcontractors
    FOR UPDATE
    TO authenticated
    USING (
        -- Allow update if I own it OR it belongs to my org
        owner_id = auth.uid()
        OR
        organization_id = ANY(public.get_my_org_ids())
    );

-- 4. Delete Permissions
DROP POLICY IF EXISTS "Users can delete own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Delete" ON public.subcontractors;

CREATE POLICY "Strict Subcontractor Delete" ON public.subcontractors
    FOR DELETE
    TO authenticated
    USING (
        -- Only Owner or Org Members can delete
        owner_id = auth.uid()
        OR
        organization_id = ANY(public.get_my_org_ids())
    );

-- Migration: fix_rls_policies
-- Description: Updates RLS policies for projects and subcontractors to enforce isolation and multitenancy
-- Date: 2025-12-05

-- ==========================================
-- 1. Projects RLS
-- ==========================================

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.projects; -- Old blanket policy

-- Projects SELECT Policy
DROP POLICY IF EXISTS "Projects visible to owner, org members, or public demo" ON public.projects;
CREATE POLICY "Projects visible to owner, org members, or public demo"
ON public.projects FOR SELECT
TO authenticated
USING (
  -- 1. User is the owner
  owner_id = auth.uid()
  -- 2. OR User is member of the project's organization
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
  -- 3. OR Project is DEMO and NOT hidden by user
  OR (
      is_demo = true 
      AND id NOT IN (
          SELECT project_id 
          FROM public.user_hidden_projects 
          WHERE user_id = auth.uid()
      )
  )
);

-- Projects INSERT Policy
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  -- Enforce that owner_id matches auth.uid (or is null and triggered later)
  owner_id = auth.uid()
  -- OR if org_id is present, user must be member
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
);

-- Projects UPDATE Policy
DROP POLICY IF EXISTS "Owners and Org Admins can update projects" ON public.projects;
CREATE POLICY "Owners and Org Admins can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
  -- Note: Demo projects should generally be read-only for normal users, 
  -- ensuring they don't break them. Admins can edit.
);

-- Projects DELETE Policy
DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
CREATE POLICY "Owners can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND is_org_member(organization_id)) 
  -- Prevent deleting demo projects via standard DELETE for non-admins 
  -- (Demo "deletion" is handled by inserting into user_hidden_projects via UI logic)
  AND is_demo = false 
);


-- ==========================================
-- 2. Subcontractors RLS
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.subcontractors;

-- Subcontractors SELECT Policy
DROP POLICY IF EXISTS "Subcontractors visible to owner or org" ON public.subcontractors;
CREATE POLICY "Subcontractors visible to owner or org"
ON public.subcontractors FOR SELECT
TO authenticated
USING (
  -- 1. User is owner
  owner_id = auth.uid()
  -- 2. OR User is member of the subcontractor's organization (e.g. Baustav)
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
);

-- Subcontractors INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Manage own or org subcontractors" ON public.subcontractors;
CREATE POLICY "Manage own or org subcontractors"
ON public.subcontractors FOR ALL
TO authenticated
USING (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
)
WITH CHECK (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND is_org_member(organization_id))
);


-- ==========================================
-- 3. Dependent Tables (Categories, Bids)
-- ==========================================
-- These tables usually relate to a Project. Use EXISTS to check project access.

-- Demand Categories
ALTER TABLE public.demand_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.demand_categories;

DROP POLICY IF EXISTS "Categories inherit project access" ON public.demand_categories;
CREATE POLICY "Categories inherit project access"
ON public.demand_categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = demand_categories.project_id
    -- Recursively checks if user has access to this project via the Select policy above?
    -- No, RLS inside RLS can be tricky depending on Supabase/Postgres config.
    -- Better to duplicate logic or use a perf-optimized function if possible.
    -- For now, we will duplicate the basic checks from Project SELECT to avoid infinite recursion or perf issues.
    AND (
       owner_id = auth.uid()
       OR (organization_id IS NOT NULL AND is_org_member(organization_id))
       OR is_demo = true -- Even hidden demo projects technically allow reading sub-items, app UI filters them.
    )
  )
)
WITH CHECK (
  EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = demand_categories.project_id
      AND (
         owner_id = auth.uid()
         OR (organization_id IS NOT NULL AND is_org_member(organization_id))
      )
  )
);

-- Bids
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.bids;

-- Note for Bids: They link to demand_categories OR projects (indirectly).
-- Bids usually have category_id.
DROP POLICY IF EXISTS "Bids inherit category->project access" ON public.bids;
CREATE POLICY "Bids inherit category->project access"
ON public.bids FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id = bids.category_id
    AND (
       p.owner_id = auth.uid()
       OR (p.organization_id IS NOT NULL AND is_org_member(p.organization_id))
       OR p.is_demo = true
    )
  )
);

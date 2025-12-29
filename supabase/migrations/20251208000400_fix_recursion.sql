-- Migration: fix_rls_recursion
-- Date: 2025-12-08
-- Description: Fixes infinite recursion between projects and project_shares policies using SECURITY DEFINER function.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_project_owner(p_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct query on projects bypasses RLS because function is SECURITY DEFINER
  -- Casting p_id to correct type if necessary, assuming projects.id is same type
  RETURN EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = p_id AND owner_id = auth.uid()
  );
END;
$$;

-- 2. Update Policies on project_shares to use the function

-- Enable RLS (ensure it's on)
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Drop recursive policies
DROP POLICY IF EXISTS "Users can see shares for their projects" ON public.project_shares;
DROP POLICY IF EXISTS "Owners can manage shares" ON public.project_shares;

-- Re-create SELECT Policy
CREATE POLICY "Users can see shares for their projects" ON public.project_shares
    FOR SELECT USING (
        -- User owns the project (via safe function)
        check_is_project_owner(project_id)
        OR
        -- OR User is the recipient
        user_id = auth.uid()
    );

-- Re-create ALL Policy (Management)
CREATE POLICY "Owners can manage shares" ON public.project_shares
    FOR ALL USING (
        -- User owns the project (via safe function)
        check_is_project_owner(project_id)
    );

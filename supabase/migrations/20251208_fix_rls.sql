-- Migration: fix_rls_and_defaults
-- Date: 2025-12-08
-- Description: Ensures RLS is enabled, sets default owner_id, and cleans up policies.

-- 1. Enable RLS explicitly
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 2. Set Default owner_id to auth.uid()
ALTER TABLE public.projects 
    ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- 3. Re-apply policies to be sure (idempotent-ish drop/create)
DROP POLICY IF EXISTS "Users can see own or shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
DROP POLICY IF EXISTS "Only owners can delete projects" ON public.projects;

-- SELECT
CREATE POLICY "Users can see own or shared projects" ON public.projects
    FOR SELECT USING (
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id AND ps.user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id
    );

-- UPDATE
CREATE POLICY "Users can update own or shared projects" ON public.projects
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id 
            AND ps.user_id = auth.uid()
            AND ps.permission = 'edit'
        )
    );

-- DELETE
CREATE POLICY "Only owners can delete projects" ON public.projects
    FOR DELETE USING (
        owner_id = auth.uid()
    );

-- 4. Fix project_shares RLS for good measure
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see shares for their projects" ON public.project_shares;
CREATE POLICY "Users can see shares for their projects" ON public.project_shares
    FOR SELECT USING (
        -- User owns the project being shared
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_shares.project_id AND p.owner_id = auth.uid()
        )
        OR
        -- OR User is the recipient
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Owners can manage shares" ON public.project_shares;
CREATE POLICY "Owners can manage shares" ON public.project_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_shares.project_id AND p.owner_id = auth.uid()
        )
    );

-- 5. Helper RPCs (ensure they exist)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input TEXT)
RETURNS UUID AS $$
DECLARE
  retrieved_id UUID;
BEGIN
  SELECT id INTO retrieved_id FROM auth.users WHERE email = email_input;
  RETURN retrieved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO authenticated;

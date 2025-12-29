-- Migration: fix_rls_allow_null_owner
-- Date: 2025-12-08
-- Description: Updates RLS policies to allow viewing/editing projects with NULL owner_id (legacy support).

-- 1. SELECT Policy (Visible if Owner OR Shared OR Owner IS NULL)
DROP POLICY IF EXISTS "Users can see own or shared projects" ON public.projects;
CREATE POLICY "Users can see own or shared projects" ON public.projects
    FOR SELECT USING (
        owner_id IS NULL -- Allow public/legacy projects
        OR
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id AND ps.user_id = auth.uid()
        )
    );

-- 2. UPDATE Policy (Editable if Owner OR Shared Permission OR Owner IS NULL)
-- Note: Allowing anyone to edit NULL-owner projects might be risky, but consistent with "legacy public" behavior.
DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
CREATE POLICY "Users can update own or shared projects" ON public.projects
    FOR UPDATE USING (
        owner_id IS NULL
        OR
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id 
            AND ps.user_id = auth.uid()
            AND ps.permission = 'edit'
        )
    );

-- 3. DELETE Policy (Only if Owner, or if NULL owner? Let's restrict delete to be safe, or allow if NULL)
-- Safety choice: Only allow delete if you CLAIM the project first or if you are admin.
-- For now, let's keep DELETE restricted to explicit owners. Users can claim a NULL project by updating its owner_id?
-- Actually, let's allow Update of owner_id for NULL projects.

-- Allow claiming orphan projects (Update owner_id where owner_id is null)
-- This is covered by the UPDATE policy above.

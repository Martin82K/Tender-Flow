-- Migration: property_isolation_and_sharing
-- Description: Creates project_shares table, updates RLS, and adds RPCs for user lookup/sharing
-- Date: 2025-12-08

-- 1. Create project_shares table
CREATE TABLE IF NOT EXISTS public.project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(255) REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(50) DEFAULT 'edit', -- 'view', 'edit'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(project_id, user_id)
);

-- 2. Enable RLS on project_shares
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- 3. RLS for project_shares
DROP POLICY IF EXISTS "Users can see shares for their projects" ON public.project_shares;
CREATE POLICY "Users can see shares for their projects" ON public.project_shares
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_shares.project_id AND p.owner_id = auth.uid()
        )
        OR
        user_id = auth.uid() -- Recipient can see their own share record
    );

DROP POLICY IF EXISTS "Owners can manage shares" ON public.project_shares;
CREATE POLICY "Owners can manage shares" ON public.project_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_shares.project_id AND p.owner_id = auth.uid()
        )
    );

-- 4. Update Projects RLS
DROP POLICY IF EXISTS "Users can see own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can see own or shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
DROP POLICY IF EXISTS "Only owners can delete projects" ON public.projects;

-- SELECT: Owner OR Shared
CREATE POLICY "Users can see own or shared projects" ON public.projects
    FOR SELECT USING (
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id AND ps.user_id = auth.uid()
        )
    );

-- INSERT: Authenticated users can create projects
CREATE POLICY "Users can insert projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id
    );

-- UPDATE: Owner OR Editor
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

-- DELETE: Only Owner
CREATE POLICY "Only owners can delete projects" ON public.projects
    FOR DELETE USING (
        owner_id = auth.uid()
    );

-- Grants
GRANT ALL ON public.project_shares TO authenticated;
GRANT ALL ON public.project_shares TO service_role;

-- 5. RPC Helper Functions

-- Helper to get User ID by Email (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input TEXT)
RETURNS UUID AS $$
DECLARE
  retrieved_id UUID;
BEGIN
  SELECT id INTO retrieved_id FROM auth.users WHERE email = email_input;
  RETURN retrieved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to get shares with emails for a project
CREATE OR REPLACE FUNCTION public.get_project_shares(project_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  permission VARCHAR(50)
) AS $$
BEGIN
  -- Verify ownership or permission first
  IF NOT EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id_input 
      AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = project_id_input AND user_id = auth.uid()))
  ) THEN
      RETURN; -- Return empty if no permission
  END IF;

  RETURN QUERY
  SELECT 
    ps.user_id,
    au.email::VARCHAR(255),
    ps.permission
  FROM public.project_shares ps
  JOIN auth.users au ON ps.user_id = au.id
  WHERE ps.project_id = project_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_shares TO authenticated;

-- Migration: ui_fixes_and_rpc
-- Date: 2025-12-08
-- Description: Updates RPCs to support better sharing visibility and visualization (Owner emails, NULL owner support).

-- 1. Update get_project_shares to support NULL owners (Legacy)
CREATE OR REPLACE FUNCTION public.get_project_shares(project_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  permission VARCHAR(50)
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership or permission
  -- Allow if:
  -- 1. Owner matches auth.uid
  -- 2. Owner is NULL (Legacy Public Project) -- though really if it's NULL, anyone can see?
  -- 3. User is in project_shares list
  IF NOT EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id_input 
      AND (
          owner_id = auth.uid() 
          OR owner_id IS NULL
          OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = project_id_input AND user_id = auth.uid())
      )
  ) THEN
      RETURN; -- Return empty
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
$$;

-- 2. New RPC: Get Owner Emails for visible projects
-- This allows the client to fetch ownership info separately to enrich the UI
CREATE OR REPLACE FUNCTION public.get_project_owner_emails()
RETURNS TABLE (
  project_id VARCHAR(255),
  owner_email VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::VARCHAR(255),
    au.email::VARCHAR(255)
  FROM public.projects p
  JOIN auth.users au ON p.owner_id = au.id
  WHERE 
    -- Check visibility (duplicate of RLS logic roughly)
    p.owner_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.project_shares ps 
        WHERE ps.project_id = p.id AND ps.user_id = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_shares TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_owner_emails TO authenticated;

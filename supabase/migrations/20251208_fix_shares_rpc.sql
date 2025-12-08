-- Migration: fix_shares_rpc
-- Date: 2025-12-08
-- Description: Creates v2 RPC for fetching shares to resolve loading issues in the modal.

CREATE OR REPLACE FUNCTION public.get_project_shares_v2(project_id_input TEXT)
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
  -- Simple, robust check: 
  -- 1. Is it public? (owner_id IS NULL)
  -- 2. Am I the owner?
  -- 3. Is it shared with me?
  IF NOT EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id_input 
      AND (
          owner_id IS NULL 
          OR owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = project_id_input AND user_id = auth.uid())
      )
  ) THEN
      -- If none of the above, return empty (deny access to list)
      RETURN;
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

GRANT EXECUTE ON FUNCTION public.get_project_shares_v2 TO authenticated;

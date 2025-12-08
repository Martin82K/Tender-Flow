-- Migration: debug_shares_rpc
-- Date: 2025-12-08
-- Description: Creates a simplified RPC for debugging the sharing modal issue

-- Simple RPC that just returns shares for project owners
CREATE OR REPLACE FUNCTION public.get_project_shares_debug(project_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  permission VARCHAR(50)
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    proj_owner UUID;
BEGIN
    -- Get the project owner
    SELECT owner_id INTO proj_owner 
    FROM public.projects 
    WHERE id = project_id_input;
    
    -- Log for debugging
    RAISE NOTICE 'Project: %, Owner: %, Current User: %', project_id_input, proj_owner, auth.uid();
    
    -- Only show shares if you're the owner or if project is public
    IF proj_owner IS NULL OR proj_owner = auth.uid() THEN
        RETURN QUERY
        SELECT 
            ps.user_id,
            au.email::VARCHAR(255),
            ps.permission
        FROM public.project_shares ps
        JOIN auth.users au ON ps.user_id = au.id
        WHERE ps.project_id = project_id_input;
    ELSE
        -- Not authorized
        RAISE NOTICE 'User % is not authorized to view shares for project %', auth.uid(), project_id_input;
        RETURN;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_shares_debug TO authenticated;

-- Migration: metadata_rpc
-- Date: 2025-12-08
-- Description: Adds RPC to fetch comprehensive project metadata (owner, shared users) for the dashboard.

CREATE OR REPLACE FUNCTION public.get_projects_metadata()
RETURNS TABLE (
  project_id VARCHAR(255),
  owner_email VARCHAR(255),
  shared_with_emails TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::VARCHAR(255),
    owner_u.email::VARCHAR(255) as owner_email,
    -- Array of emails shared with
    array_remove(array_agg(DISTINCT shared_u.email::TEXT), NULL) as shared_with_emails
  FROM public.projects p
  -- Join Owner
  LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
  -- Join Shares
  LEFT JOIN public.project_shares ps ON p.id = ps.project_id
  LEFT JOIN auth.users shared_u ON ps.user_id = shared_u.id
  WHERE 
    -- Visibility Check: Only return metadata for projects visible to current user
    (
        p.owner_id IS NULL -- Public
        OR
        p.owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps_check 
            WHERE ps_check.project_id = p.id AND ps_check.user_id = auth.uid()
        )
    )
  GROUP BY p.id, owner_u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_metadata TO authenticated;

-- Migration: fix_get_projects_metadata_ambiguous_column
-- Date: 2026-02-10
-- Description: Fix "column reference project_id is ambiguous" error in get_projects_metadata.
-- The RETURNS TABLE output column "project_id" conflicts with same-named columns
-- in project_shares and user_hidden_projects within the function body.

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
    p.id::VARCHAR(255) AS project_id,
    owner_u.email::VARCHAR(255) AS owner_email,
    array_remove(array_agg(DISTINCT shared_u.email::TEXT), NULL) AS shared_with_emails
  FROM public.projects p
  LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
  LEFT JOIN public.project_shares ps ON p.id = ps.project_id
  LEFT JOIN auth.users shared_u ON ps.user_id = shared_u.id
  WHERE 
    (
      p.owner_id IS NULL
      OR p.owner_id = auth.uid()
      OR public.is_project_shared_with_user(p.id, auth.uid())
      OR (
        p.is_demo = true
        AND p.id NOT IN (
          SELECT uhp.project_id
          FROM public.user_hidden_projects uhp
          WHERE uhp.user_id = auth.uid()
        )
      )
    )
  GROUP BY p.id, owner_u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_metadata TO authenticated;

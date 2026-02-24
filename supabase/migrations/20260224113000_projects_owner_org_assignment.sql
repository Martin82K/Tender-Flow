-- Migration: projects_owner_org_assignment
-- Date: 2026-02-24
-- Description: Ensure new projects get owner/org assignment and backfill missing organization_id conservatively.

CREATE OR REPLACE FUNCTION public.assign_project_owner_and_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_org_id UUID;
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  IF NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN COUNT(*) = 1 THEN (array_agg(om.organization_id ORDER BY om.organization_id))[1]
        ELSE NULL
      END
    INTO resolved_org_id
    FROM public.organization_members om
    WHERE om.user_id = NEW.owner_id;

    IF resolved_org_id IS NOT NULL THEN
      NEW.organization_id := resolved_org_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_projects_assign_owner_and_org ON public.projects;
CREATE TRIGGER tr_projects_assign_owner_and_org
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.assign_project_owner_and_organization();

DO $$
DECLARE
  updated_count INTEGER := 0;
  unresolved_count INTEGER := 0;
BEGIN
  WITH single_org_members AS (
    SELECT
      om.user_id,
      (array_agg(om.organization_id ORDER BY om.organization_id))[1] AS organization_id
    FROM public.organization_members om
    GROUP BY om.user_id
    HAVING COUNT(*) = 1
  ),
  updated_rows AS (
    UPDATE public.projects p
    SET organization_id = som.organization_id
    FROM single_org_members som
    WHERE p.organization_id IS NULL
      AND p.owner_id = som.user_id
    RETURNING p.id
  )
  SELECT COUNT(*)
  INTO updated_count
  FROM updated_rows;

  SELECT COUNT(*)
  INTO unresolved_count
  FROM public.projects p
  WHERE p.organization_id IS NULL
    AND p.owner_id IS NOT NULL;

  RAISE NOTICE 'projects.organization_id backfilled rows: %', updated_count;
  RAISE NOTICE 'projects with owner_id but organization_id still NULL: %', unresolved_count;
END $$;

-- Verification output for manual follow-up:
-- projects that still cannot be assigned automatically (0 or multiple org memberships for owner).
SELECT
  p.id AS project_id,
  p.owner_id,
  COALESCE(u.email::TEXT, '(unknown)') AS owner_email,
  COALESCE(m.org_count, 0) AS owner_organization_count
FROM public.projects p
LEFT JOIN auth.users u ON u.id = p.owner_id
LEFT JOIN (
  SELECT
    om.user_id,
    COUNT(*)::INTEGER AS org_count
  FROM public.organization_members om
  GROUP BY om.user_id
) m ON m.user_id = p.owner_id
WHERE p.organization_id IS NULL
  AND p.owner_id IS NOT NULL
ORDER BY owner_email, p.id;

-- Migration: transfer_project_ownership
-- Date: 2026-04-17
-- Description: RPC umožňující aktuálnímu vlastníkovi projektu předat
--              vlastnictví jinému aktivnímu členovi stejné organizace.

CREATE OR REPLACE FUNCTION public.transfer_project_ownership(
  project_id_input UUID,
  new_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner UUID;
  project_org UUID;
  project_is_demo BOOLEAN;
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Nepřihlášený uživatel' USING ERRCODE = 'P0001';
  END IF;

  IF project_id_input IS NULL OR new_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Chybí identifikátor projektu nebo nového vlastníka' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.owner_id, p.organization_id, COALESCE(p.is_demo, FALSE)
    INTO current_owner, project_org, project_is_demo
  FROM public.projects p
  WHERE p.id = project_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projekt nebyl nalezen' USING ERRCODE = 'P0001';
  END IF;

  IF project_is_demo THEN
    RAISE EXCEPTION 'Demo projekt nelze předat jinému vlastníkovi' USING ERRCODE = 'P0001';
  END IF;

  IF current_owner IS NULL OR current_owner <> caller THEN
    RAISE EXCEPTION 'Pouze aktuální vlastník může předat stavbu' USING ERRCODE = 'P0001';
  END IF;

  IF new_owner_user_id = current_owner THEN
    RAISE EXCEPTION 'Nový vlastník je shodný s aktuálním' USING ERRCODE = 'P0001';
  END IF;

  IF project_org IS NULL THEN
    RAISE EXCEPTION 'Stavbu bez přiřazené organizace nelze předat' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = project_org
      AND om.user_id = new_owner_user_id
      AND COALESCE(om.is_active, TRUE) = TRUE
  ) THEN
    RAISE EXCEPTION 'Nový vlastník není aktivním členem organizace stavby' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.projects
  SET owner_id = new_owner_user_id
  WHERE id = project_id_input;

  -- Pokud měl nový vlastník projekt nasdílený, sdílení odstraníme
  -- (vlastnictví ho implicitně plně pokrývá).
  DELETE FROM public.project_shares
  WHERE project_id = project_id_input
    AND user_id = new_owner_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_project_ownership(UUID, UUID) TO authenticated;

-- Shared editors may update ordinary project fields, but global DocHub
-- configuration is owner-controlled. Enforce this at the database boundary so
-- direct REST requests cannot bypass the UI guard. The prefix-based comparison
-- automatically covers future dochub_* columns as well.

CREATE OR REPLACE FUNCTION public.enforce_dochub_owner_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  old_dochub JSONB;
  new_dochub JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id
    AND OLD.owner_id IS DISTINCT FROM auth.uid()
    AND current_user <> 'postgres'
  THEN
    RAISE EXCEPTION 'Only the current project owner may transfer project ownership'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_object_agg(key, value)
  INTO old_dochub
  FROM jsonb_each(to_jsonb(OLD))
  WHERE key LIKE 'dochub\_%' ESCAPE '\';

  SELECT jsonb_object_agg(key, value)
  INTO new_dochub
  FROM jsonb_each(to_jsonb(NEW))
  WHERE key LIKE 'dochub\_%' ESCAPE '\';

  IF old_dochub IS DISTINCT FROM new_dochub
    AND OLD.owner_id IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Only the project owner may change DocHub settings'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_dochub_owner_updates() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_dochub_owner_updates
  ON public.projects;

CREATE TRIGGER enforce_dochub_owner_updates
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dochub_owner_updates();

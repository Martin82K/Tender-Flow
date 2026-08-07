ALTER TABLE public.dochub_project_folders
  ALTER COLUMN key SET DEFAULT '';

UPDATE public.dochub_project_folders
SET key = ''
WHERE key IS NULL;

ALTER TABLE public.dochub_project_folders
  ALTER COLUMN key SET NOT NULL;

ALTER TABLE public.dochub_project_folders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dochub_project_folders FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dochub_project_folders TO service_role;

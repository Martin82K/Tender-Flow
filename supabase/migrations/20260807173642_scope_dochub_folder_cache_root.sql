-- Cache entries must belong to the currently configured cloud root. Existing
-- entries cannot be proven safe after historical root switches, so remove them
-- until an owner refreshes or recreates the structure. The root is part of the
-- primary key so a late writer for an old root cannot overwrite the current one.

ALTER TABLE public.dochub_project_folders
  ADD COLUMN IF NOT EXISTS root_id TEXT;

DELETE FROM public.dochub_project_folders;

ALTER TABLE public.dochub_project_folders
  ALTER COLUMN root_id SET NOT NULL;

ALTER TABLE public.dochub_project_folders
  DROP CONSTRAINT IF EXISTS dochub_project_folders_pkey;

ALTER TABLE public.dochub_project_folders
  ADD CONSTRAINT dochub_project_folders_pkey
  PRIMARY KEY (project_id, provider, root_id, kind, key);

CREATE INDEX IF NOT EXISTS idx_dochub_project_folders_current_root
  ON public.dochub_project_folders (project_id, provider, root_id);

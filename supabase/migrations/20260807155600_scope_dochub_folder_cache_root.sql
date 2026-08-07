-- Cache entries must belong to the currently configured cloud root. Existing
-- entries cannot be proven safe after historical root switches, so leave them
-- invalidated until an owner refreshes or recreates the structure.

ALTER TABLE public.dochub_project_folders
  ADD COLUMN IF NOT EXISTS root_id TEXT;

UPDATE public.dochub_project_folders
SET root_id = NULL;

CREATE INDEX IF NOT EXISTS idx_dochub_project_folders_current_root
  ON public.dochub_project_folders (project_id, provider, root_id);

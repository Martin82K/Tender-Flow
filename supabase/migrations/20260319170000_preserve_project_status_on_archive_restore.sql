ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_original_status VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_archived_original_status_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_archived_original_status_check
      CHECK (
        archived_original_status IS NULL
        OR archived_original_status IN ('tender', 'realization')
      );
  END IF;
END $$;

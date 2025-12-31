-- Migration: dochub_autocreate_runs
-- Date: 2025-12-31
-- Description: Stores live progress + logs for DocHub auto-create runs (polled by frontend).

CREATE TABLE IF NOT EXISTS public.dochub_autocreate_runs (
  id UUID PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT CHECK (provider IN ('gdrive', 'onedrive')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  step TEXT,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  total_actions INTEGER,
  completed_actions INTEGER NOT NULL DEFAULT 0,
  logs TEXT[] NOT NULL DEFAULT '{}'::text[],
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS dochub_autocreate_runs_project_id_idx ON public.dochub_autocreate_runs(project_id);
CREATE INDEX IF NOT EXISTS dochub_autocreate_runs_user_id_idx ON public.dochub_autocreate_runs(user_id);

ALTER TABLE public.dochub_autocreate_runs ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own runs (writing is done by service_role in edge functions).
DROP POLICY IF EXISTS "Users can read own dochub autocreate runs" ON public.dochub_autocreate_runs;
CREATE POLICY "Users can read own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR SELECT
TO authenticated
USING (user_id = auth.uid());


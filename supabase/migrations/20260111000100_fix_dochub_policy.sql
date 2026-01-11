-- Migration: fix_dochub_policy
-- Date: 2026-01-11
-- Description: Allow users to insert their own runs into dochub_autocreate_runs table.

-- Drop existing INSERT policy if it exists (unlikely given the error, but good practice)
DROP POLICY IF EXISTS "Users can insert own dochub autocreate runs" ON public.dochub_autocreate_runs;

CREATE POLICY "Users can insert own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Migration: fix_dochub_permissions
-- Date: 2026-01-14
-- Description: Comprehensive fix for dochub_autocreate_runs RLS policies to allow frontend inserts/updates/deletes.

-- Enable RLS (idempotent)
ALTER TABLE public.dochub_autocreate_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can read own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can insert own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can update own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can delete own dochub autocreate runs" ON public.dochub_autocreate_runs;

-- 1. SELECT
CREATE POLICY "Users can read own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. INSERT
CREATE POLICY "Users can insert own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. UPDATE
CREATE POLICY "Users can update own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. DELETE
CREATE POLICY "Users can delete own dochub autocreate runs"
ON public.dochub_autocreate_runs FOR DELETE
TO authenticated
USING (user_id = auth.uid());

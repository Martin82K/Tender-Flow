-- Migration: reset_policies
-- Date: 2025-12-08
-- Description: Drops ALL existing policies on 'projects' to ensure no leftover permissive rules exist, then re-applies strict rules.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop ALL policies on public.projects
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.projects';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- 2. Re-Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Re-Create Strict SELECT Policy
-- Visible if:
--   a) Owner is NULL (Legacy/Public)
--   b) You are the Owner
--   c) It is shared with you
CREATE POLICY "Strict Project Visibility" ON public.projects
    FOR SELECT USING (
        owner_id IS NULL 
        OR 
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id AND ps.user_id = auth.uid()
        )
    );

-- 4. Re-Create INSERT Policy
CREATE POLICY "Strict Project Insert" ON public.projects
    FOR INSERT WITH CHECK (
        -- Allow insert if authenticated. Recommend setting owner_id.
        auth.role() = 'authenticated'
    );

-- 5. Re-Create UPDATE Policy
CREATE POLICY "Strict Project Update" ON public.projects
    FOR UPDATE USING (
        owner_id IS NULL
        OR
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = projects.id 
            AND ps.user_id = auth.uid()
            AND ps.permission = 'edit'
        )
    );

-- 6. Re-Create DELETE Policy
CREATE POLICY "Strict Project Delete" ON public.projects
    FOR DELETE USING (
        owner_id IS NULL
        OR
        owner_id = auth.uid()
    );



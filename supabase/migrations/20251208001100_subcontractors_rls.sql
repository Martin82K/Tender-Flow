-- Migration: subcontractors_rls
-- Date: 2025-12-08
-- Description: Enables RLS on subcontractors and defines visibility policies.

-- 1. Enable RLS
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- 2. Set Default owner_id to auth.uid() for new inserts
ALTER TABLE public.subcontractors 
    ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- 3. SELECT Policy (Visible if Owner OR Owner IS NULL - Public Legacy)
DROP POLICY IF EXISTS "Users can view own or public subcontractors" ON public.subcontractors;
CREATE POLICY "Users can view own or public subcontractors" ON public.subcontractors
    FOR SELECT USING (
        owner_id IS NULL 
        OR 
        owner_id = auth.uid()
        -- Future: OR organization logic
    );

-- 4. INSERT Policy (Authenticated users can insert, typically sets owner_id via default or explicit)
DROP POLICY IF EXISTS "Users can insert subcontractors" ON public.subcontractors;
CREATE POLICY "Users can insert subcontractors" ON public.subcontractors
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

-- 5. UPDATE Policy (Owners can update own, and Public contacts can be updated by anyone for now to prevent lockouts)
DROP POLICY IF EXISTS "Users can update own or public subcontractors" ON public.subcontractors;
CREATE POLICY "Users can update own or public subcontractors" ON public.subcontractors
    FOR UPDATE USING (
        owner_id IS NULL 
        OR 
        owner_id = auth.uid()
    );

-- 6. DELETE Policy (Owners only? Or Public too?)
-- Safest: Owners or Admin. For legacy public, maybe allow delete if you created it? 
-- But since owner_id is NULL, we don't know who created it.
-- Let's allow deleting legacy public contacts for now to avoid frustration.
DROP POLICY IF EXISTS "Users can delete own or public subcontractors" ON public.subcontractors;
CREATE POLICY "Users can delete own or public subcontractors" ON public.subcontractors
    FOR DELETE USING (
        owner_id IS NULL 
        OR 
        owner_id = auth.uid()
    );

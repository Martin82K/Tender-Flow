-- Complete fix for contact persistence
-- Run this entire file in Supabase SQL Editor

-- 1. Check current column type
-- If specialization is already TEXT[], skip the conversion
DO $$
BEGIN
    -- Only convert if it's still VARCHAR
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subcontractors' 
        AND column_name = 'specialization' 
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE public.subcontractors 
        ALTER COLUMN specialization TYPE TEXT[] 
        USING string_to_array(COALESCE(NULLIF(specialization, ''), 'Ostatní'), ',');
    END IF;
END $$;
-- 2. Seed subcontractor statuses
INSERT INTO public.subcontractor_statuses (id, label, color) VALUES
('available', 'K dispozici', 'green'),
('busy', 'Zaneprázdněn', 'red'),
('waiting', 'Čeká', 'yellow')
ON CONFLICT (id) DO NOTHING;
-- 3. Verify RLS policies are correct
-- Drop and recreate to ensure they're correct
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.subcontractors;
-- Recreate policies
CREATE POLICY "Enable read access for authenticated users"
ON public.subcontractors FOR SELECT
TO authenticated
USING (true);
CREATE POLICY "Enable insert access for authenticated users"
ON public.subcontractors FOR INSERT
TO authenticated
WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users"
ON public.subcontractors FOR UPDATE
TO authenticated
USING (true);
CREATE POLICY "Enable delete access for authenticated users"
ON public.subcontractors FOR DELETE
TO authenticated
USING (true);
-- 4. Verify table structure
-- This will show you the current structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'subcontractors'
ORDER BY ordinal_position;

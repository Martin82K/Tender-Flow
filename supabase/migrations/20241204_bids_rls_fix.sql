-- RLS Fix for Bids Table + Add Missing Columns
-- Run this in Supabase SQL Editor
-- Date: 2024-12-04

-- ==========================================
-- STEP 0: Fix column lengths (id is VARCHAR(36) but IDs are longer)
-- ==========================================
ALTER TABLE public.bids ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.bids ALTER COLUMN subcontractor_id TYPE TEXT;
ALTER TABLE public.bids ALTER COLUMN category_id TYPE TEXT;

-- ==========================================
-- STEP 1: Add missing columns to bids table
-- ==========================================
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add demand_category_id as alias column for App.tsx compatibility (TEXT for longer IDs)
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS demand_category_id TEXT;

-- Populate demand_category_id from category_id where missing
UPDATE public.bids SET demand_category_id = category_id WHERE demand_category_id IS NULL;

-- Remove foreign key constraint on subcontractor_id (allows bids for contacts not in DB)
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_subcontractor_id_fkey;

-- Remove foreign key constraint on category_id (might have different name)
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_category_id_fkey;

-- Add 'contacted' to status check constraint
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE public.bids ADD CONSTRAINT bids_status_check 
CHECK (status IN ('contacted', 'sent', 'offer', 'shortlist', 'sod', 'rejected'));

-- ==========================================
-- STEP 2: Enable Row Level Security on bids
-- ==========================================
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 3: Drop old policies and create new ones
-- ==========================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bids;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.bids;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.bids;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.bids;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.bids;

-- Create comprehensive policy for all operations
CREATE POLICY "Allow all authenticated users"
ON public.bids
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==========================================
-- STEP 4: Grant permissions
-- ==========================================
GRANT ALL ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;

-- ==========================================
-- STEP 5: Verify table structure
-- ==========================================
SELECT 'bids table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'bids'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 'RLS policies on bids:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'bids';

-- Count existing records
SELECT 'Current bid count:' as info, COUNT(*) as count FROM public.bids;

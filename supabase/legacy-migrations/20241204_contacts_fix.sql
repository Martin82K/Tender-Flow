-- Legacy script (not used by Supabase migrations)
-- Original file moved from supabase/migrations because it is not compatible with the current baseline migration chain.

-- Complete fix for contacts persistence
-- Run this file in Supabase SQL Editor
-- Date: 2024-12-04

-- ==========================================
-- STEP 1: Ensure subcontractors table exists
-- ==========================================
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id VARCHAR(36) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255),
    specialization TEXT[],
    phone VARCHAR(50),
    email VARCHAR(255),
    ico VARCHAR(50),
    region VARCHAR(100),
    status_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- STEP 2: Ensure subcontractor_statuses exists
-- ==========================================
CREATE TABLE IF NOT EXISTS public.subcontractor_statuses (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(20) CHECK (color IN ('green', 'red', 'yellow', 'blue', 'purple', 'slate'))
);

-- Seed default statuses
INSERT INTO public.subcontractor_statuses (id, label, color) VALUES
('available', 'K dispozici', 'green'),
('busy', 'Zaneprázdněn', 'red'),
('waiting', 'Čeká', 'yellow')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- STEP 3: Enable Row Level Security
-- ==========================================
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 4: Drop old policies and create new ones
-- ==========================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.subcontractors;

-- Create comprehensive policy for all operations
CREATE POLICY "Allow all authenticated users"
ON public.subcontractors
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==========================================
-- STEP 5: Grant permissions
-- ==========================================
GRANT ALL ON public.subcontractors TO authenticated;
GRANT ALL ON public.subcontractors TO service_role;
GRANT ALL ON public.subcontractor_statuses TO authenticated;
GRANT ALL ON public.subcontractor_statuses TO service_role;


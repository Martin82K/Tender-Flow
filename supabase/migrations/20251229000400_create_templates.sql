-- Migration: create_templates
-- Date: 2025-12-29
-- Description: Creates templates table used by the inquiry letter editor.

CREATE TABLE IF NOT EXISTS public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.templates;

CREATE POLICY "Enable read access for authenticated users" ON public.templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.templates
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.templates
    FOR DELETE USING (auth.role() = 'authenticated');

GRANT ALL ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;


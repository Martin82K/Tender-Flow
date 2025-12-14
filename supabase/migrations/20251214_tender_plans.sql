-- Migration: tender_plans
-- Date: 2025-12-14
-- Description: Create tender_plans table for storing VŘ plan items per project

-- Create tender_plans table
CREATE TABLE IF NOT EXISTS public.tender_plans (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES public.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date_from DATE,
    date_to DATE,
    category_id VARCHAR(36) REFERENCES public.demand_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.tender_plans ENABLE ROW LEVEL SECURITY;

-- Select policy: users can see tender plans for projects they have access to
DROP POLICY IF EXISTS "Select tender_plans via project" ON public.tender_plans;
CREATE POLICY "Select tender_plans via project" ON public.tender_plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tender_plans.project_id
            AND (
                p.owner_id = auth.uid() OR
                p.owner_id IS NULL OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
            )
        )
    );

-- Manage policy: users can insert/update/delete tender plans for projects they can edit
DROP POLICY IF EXISTS "Manage tender_plans via project" ON public.tender_plans;
CREATE POLICY "Manage tender_plans via project" ON public.tender_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tender_plans.project_id
            AND (
                p.owner_id = auth.uid() OR
                p.owner_id IS NULL OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
            )
        )
    );

-- Grant permissions
GRANT ALL ON public.tender_plans TO authenticated;
GRANT ALL ON public.tender_plans TO service_role;

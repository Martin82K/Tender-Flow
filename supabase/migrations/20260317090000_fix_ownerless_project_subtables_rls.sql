-- Migration: fix_ownerless_project_subtables_rls
-- Date: 2026-03-17
-- Description: Removes owner_id IS NULL bypass from project subtable RLS policies.

-- 1. Project Contracts
DROP POLICY IF EXISTS "Select contracts via project" ON public.project_contracts;
CREATE POLICY "Select contracts via project" ON public.project_contracts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_contracts.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage contracts via project" ON public.project_contracts;
CREATE POLICY "Manage contracts via project" ON public.project_contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_contracts.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
            )
        )
    );

-- 2. Project Investor Financials
DROP POLICY IF EXISTS "Select financials via project" ON public.project_investor_financials;
CREATE POLICY "Select financials via project" ON public.project_investor_financials
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_investor_financials.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage financials via project" ON public.project_investor_financials;
CREATE POLICY "Manage financials via project" ON public.project_investor_financials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_investor_financials.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
            )
        )
    );

-- 3. Project Amendments
DROP POLICY IF EXISTS "Select amendments via project" ON public.project_amendments;
CREATE POLICY "Select amendments via project" ON public.project_amendments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_amendments.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage amendments via project" ON public.project_amendments;
CREATE POLICY "Manage amendments via project" ON public.project_amendments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_amendments.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
            )
        )
    );

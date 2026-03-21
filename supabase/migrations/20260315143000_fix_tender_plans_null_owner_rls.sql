-- Migration: tighten tender_plans RLS for orphaned projects
-- Description: prevent authenticated users from accessing tender_plans when project.owner_id is NULL

DROP POLICY IF EXISTS "Select tender_plans via project" ON public.tender_plans;
CREATE POLICY "Select tender_plans via project" ON public.tender_plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tender_plans.project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage tender_plans via project" ON public.tender_plans;
CREATE POLICY "Manage tender_plans via project" ON public.tender_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tender_plans.project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

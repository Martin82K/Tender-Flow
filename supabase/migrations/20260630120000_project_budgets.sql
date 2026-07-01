-- Project itemized budgets
-- Stores EasyCalc-style budget structures under Tender Flow projects.

CREATE TABLE IF NOT EXISTS public.project_budgets (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'locked')),
    currency VARCHAR(3) NOT NULL DEFAULT 'CZK' CHECK (currency = 'CZK'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_budget_sheets (
    id VARCHAR(36) PRIMARY KEY,
    budget_id VARCHAR(36) NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_budget_categories (
    id VARCHAR(36) PRIMARY KEY,
    sheet_id VARCHAR(36) NOT NULL REFERENCES public.project_budget_sheets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(80),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_budget_items (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) NOT NULL REFERENCES public.project_budget_categories(id) ON DELETE CASCADE,
    demand_category_id VARCHAR(36) REFERENCES public.demand_categories(id) ON DELETE SET NULL,
    position_label VARCHAR(40),
    code VARCHAR(80),
    name VARCHAR(500) NOT NULL,
    unit VARCHAR(40) NOT NULL DEFAULT 'ks',
    amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    vat_rate INTEGER NOT NULL DEFAULT 21 CHECK (vat_rate IN (0, 12, 21)),
    margin_percent DECIMAL(7, 2) NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_budget_measurements (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL REFERENCES public.project_budget_items(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    formula TEXT,
    result DECIMAL(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_budgets_project_id ON public.project_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_sheets_budget_id ON public.project_budget_sheets(budget_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_categories_sheet_id ON public.project_budget_categories(sheet_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_items_category_id ON public.project_budget_items(category_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_items_demand_category_id ON public.project_budget_items(demand_category_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_measurements_item_id ON public.project_budget_measurements(item_id);

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select project_budgets via project" ON public.project_budgets;
CREATE POLICY "Select project_budgets via project" ON public.project_budgets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_budgets.project_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage project_budgets via project" ON public.project_budgets;
CREATE POLICY "Manage project_budgets via project" ON public.project_budgets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_budgets.project_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_budgets.project_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Select project_budget_sheets via project" ON public.project_budget_sheets;
CREATE POLICY "Select project_budget_sheets via project" ON public.project_budget_sheets
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.project_budgets b
            JOIN public.projects p ON p.id = b.project_id
            WHERE b.id = project_budget_sheets.budget_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage project_budget_sheets via project" ON public.project_budget_sheets;
CREATE POLICY "Manage project_budget_sheets via project" ON public.project_budget_sheets
    FOR ALL USING (
        EXISTS (
            SELECT 1
            FROM public.project_budgets b
            JOIN public.projects p ON p.id = b.project_id
            WHERE b.id = project_budget_sheets.budget_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.project_budgets b
            JOIN public.projects p ON p.id = b.project_id
            WHERE b.id = project_budget_sheets.budget_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Select project_budget_categories via project" ON public.project_budget_categories;
CREATE POLICY "Select project_budget_categories via project" ON public.project_budget_categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_sheets s
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE s.id = project_budget_categories.sheet_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage project_budget_categories via project" ON public.project_budget_categories;
CREATE POLICY "Manage project_budget_categories via project" ON public.project_budget_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_sheets s
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE s.id = project_budget_categories.sheet_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.project_budget_sheets s
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE s.id = project_budget_categories.sheet_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Select project_budget_items via project" ON public.project_budget_items;
CREATE POLICY "Select project_budget_items via project" ON public.project_budget_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_categories c
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE c.id = project_budget_items.category_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage project_budget_items via project" ON public.project_budget_items;
CREATE POLICY "Manage project_budget_items via project" ON public.project_budget_items
    FOR ALL USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_categories c
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE c.id = project_budget_items.category_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.project_budget_categories c
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE c.id = project_budget_items.category_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Select project_budget_measurements via project" ON public.project_budget_measurements;
CREATE POLICY "Select project_budget_measurements via project" ON public.project_budget_measurements
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_items i
            JOIN public.project_budget_categories c ON c.id = i.category_id
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE i.id = project_budget_measurements.item_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage project_budget_measurements via project" ON public.project_budget_measurements;
CREATE POLICY "Manage project_budget_measurements via project" ON public.project_budget_measurements
    FOR ALL USING (
        EXISTS (
            SELECT 1
            FROM public.project_budget_items i
            JOIN public.project_budget_categories c ON c.id = i.category_id
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE i.id = project_budget_measurements.item_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.project_budget_items i
            JOIN public.project_budget_categories c ON c.id = i.category_id
            JOIN public.project_budget_sheets s ON s.id = c.sheet_id
            JOIN public.project_budgets b ON b.id = s.budget_id
            JOIN public.projects p ON p.id = b.project_id
            WHERE i.id = project_budget_measurements.item_id
            AND p.owner_id IS NOT NULL
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.user_id = auth.uid()
                    AND ps.permission = 'edit'
                )
            )
        )
    );

GRANT ALL ON public.project_budgets TO authenticated;
GRANT ALL ON public.project_budget_sheets TO authenticated;
GRANT ALL ON public.project_budget_categories TO authenticated;
GRANT ALL ON public.project_budget_items TO authenticated;
GRANT ALL ON public.project_budget_measurements TO authenticated;

GRANT ALL ON public.project_budgets TO service_role;
GRANT ALL ON public.project_budget_sheets TO service_role;
GRANT ALL ON public.project_budget_categories TO service_role;
GRANT ALL ON public.project_budget_items TO service_role;
GRANT ALL ON public.project_budget_measurements TO service_role;

-- =====================================================
-- Project investor invoices — fakturace na investora
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_investor_invoices (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CZK',
  status TEXT NOT NULL
    CHECK (status IN ('issued','approved','paid','overdue'))
    DEFAULT 'issued',
  paid_at DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_investor_invoices_project
  ON public.project_investor_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_project_investor_invoices_due_date
  ON public.project_investor_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_project_investor_invoices_status
  ON public.project_investor_invoices(status);

CREATE OR REPLACE FUNCTION public.update_project_investor_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_project_investor_invoices_updated_at
  ON public.project_investor_invoices;
CREATE TRIGGER tr_project_investor_invoices_updated_at
  BEFORE UPDATE ON public.project_investor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_project_investor_invoices_updated_at();

ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select investor invoices via project"
  ON public.project_investor_invoices;
CREATE POLICY "Select investor invoices via project"
  ON public.project_investor_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_invoices.project_id
        AND (
          p.owner_id = auth.uid()
          OR p.owner_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manage investor invoices via project"
  ON public.project_investor_invoices;
CREATE POLICY "Manage investor invoices via project"
  ON public.project_investor_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_invoices.project_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_invoices.project_id
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

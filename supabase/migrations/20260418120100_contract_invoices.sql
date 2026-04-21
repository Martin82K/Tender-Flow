-- =====================================================
-- Contract invoices — fakturace ke smlouvám
-- Migration: 20260418120100_contract_invoices.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  status TEXT NOT NULL
    CHECK (status IN ('issued','approved','paid','overdue'))
    DEFAULT 'issued',
  paid_at DATE,
  document_url TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract ON contract_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_due_date ON contract_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_status ON contract_invoices(status);

-- Updated_at trigger (reuse existing function from contracts_module migration)
DROP TRIGGER IF EXISTS tr_contract_invoices_updated_at ON contract_invoices;
CREATE TRIGGER tr_contract_invoices_updated_at
  BEFORE UPDATE ON contract_invoices
  FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

-- RLS: stejný vzor jako contract_amendments/drawdowns
ALTER TABLE contract_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_invoices_select" ON contract_invoices;
CREATE POLICY "contract_invoices_select" ON contract_invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id
    WHERE c.id = contract_invoices.contract_id
      AND (
        p.owner_id = auth.uid() OR p.owner_id IS NULL OR
        EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id AND ps.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "contract_invoices_insert" ON contract_invoices;
CREATE POLICY "contract_invoices_insert" ON contract_invoices FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id
    WHERE c.id = contract_invoices.contract_id
      AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id
            AND ps.user_id = auth.uid()
            AND ps.permission = 'edit'
        )
      )
  )
);

DROP POLICY IF EXISTS "contract_invoices_update" ON contract_invoices;
CREATE POLICY "contract_invoices_update" ON contract_invoices FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id
    WHERE c.id = contract_invoices.contract_id
      AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id
            AND ps.user_id = auth.uid()
            AND ps.permission = 'edit'
        )
      )
  )
);

DROP POLICY IF EXISTS "contract_invoices_delete" ON contract_invoices;
CREATE POLICY "contract_invoices_delete" ON contract_invoices FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id
    WHERE c.id = contract_invoices.contract_id AND p.owner_id = auth.uid()
  )
);

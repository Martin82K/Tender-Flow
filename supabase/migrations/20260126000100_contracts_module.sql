-- =====================================================
-- CONTRACTS MODULE - Complete Schema
-- Migration: 20260126000100_contracts_module.sql
-- =====================================================

-- 1. CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id VARCHAR(36) REFERENCES subcontractors(id) ON DELETE SET NULL,
    vendor_name TEXT NOT NULL, -- Denormalized for performance

    title TEXT NOT NULL,
    contract_number TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),

    signed_at DATE,
    effective_from DATE,
    effective_to DATE,

    currency TEXT DEFAULT 'CZK',
    base_price NUMERIC(15,2) NOT NULL DEFAULT 0,

    retention_percent NUMERIC(5,2),
    retention_amount NUMERIC(15,2),
    warranty_months INTEGER,
    payment_terms TEXT,
    scope_summary TEXT,

    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'from_tender_winner', 'ai_extracted')),
    source_bid_id VARCHAR(36), -- Reference to winning bid if source = from_tender_winner

    document_url TEXT, -- Uploaded PDF URL
    extraction_confidence NUMERIC(3,2), -- 0.00-1.00
    extraction_json JSONB,

    owner_id UUID REFERENCES auth.users(id),
    organization_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONTRACT AMENDMENTS TABLE
CREATE TABLE IF NOT EXISTS contract_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    amendment_no INTEGER NOT NULL,

    signed_at DATE,
    effective_from DATE,

    delta_price NUMERIC(15,2) DEFAULT 0,
    delta_deadline DATE, -- New deadline or NULL
    reason TEXT,

    document_url TEXT,
    extraction_json JSONB,
    extraction_confidence NUMERIC(3,2),

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(contract_id, amendment_no)
);

-- 3. CONTRACT DRAWDOWNS TABLE
CREATE TABLE IF NOT EXISTS contract_drawdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- Format: YYYY-MM

    claimed_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(15,2) NOT NULL DEFAULT 0,

    note TEXT,
    document_url TEXT,
    extraction_json JSONB,
    extraction_confidence NUMERIC(3,2),

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(contract_id, period)
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_amendments_contract ON contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS idx_drawdowns_contract ON contract_drawdowns(contract_id);
CREATE INDEX IF NOT EXISTS idx_drawdowns_period ON contract_drawdowns(period);

-- 5. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION get_contract_current_total(contract_id_input UUID)
RETURNS NUMERIC AS $$
    SELECT COALESCE(c.base_price, 0) + COALESCE(SUM(a.delta_price), 0)
    FROM contracts c
    LEFT JOIN contract_amendments a ON a.contract_id = c.id
    WHERE c.id = contract_id_input
    GROUP BY c.id, c.base_price;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_contract_approved_sum(contract_id_input UUID)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(approved_amount), 0)
    FROM contract_drawdowns
    WHERE contract_id = contract_id_input;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_contract_remaining(contract_id_input UUID)
RETURNS NUMERIC AS $$
    SELECT get_contract_current_total(contract_id_input) - get_contract_approved_sum(contract_id_input);
$$ LANGUAGE SQL STABLE;

-- 6. AUTO-INCREMENT AMENDMENT NUMBER
CREATE OR REPLACE FUNCTION set_amendment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.amendment_no IS NULL THEN
        SELECT COALESCE(MAX(amendment_no), 0) + 1 INTO NEW.amendment_no
        FROM contract_amendments WHERE contract_id = NEW.contract_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_amendment_number ON contract_amendments;
CREATE TRIGGER tr_amendment_number
    BEFORE INSERT ON contract_amendments
    FOR EACH ROW EXECUTE FUNCTION set_amendment_number();

-- 7. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_contracts_updated_at ON contracts;
CREATE TRIGGER tr_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

DROP TRIGGER IF EXISTS tr_amendments_updated_at ON contract_amendments;
CREATE TRIGGER tr_amendments_updated_at BEFORE UPDATE ON contract_amendments
    FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

DROP TRIGGER IF EXISTS tr_drawdowns_updated_at ON contract_drawdowns;
CREATE TRIGGER tr_drawdowns_updated_at BEFORE UPDATE ON contract_drawdowns
    FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

-- 8. RLS POLICIES (via project access)
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_drawdowns ENABLE ROW LEVEL SECURITY;

-- Contracts policies
DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_select" ON contracts FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = contracts.project_id AND (
        p.owner_id = auth.uid() OR p.owner_id IS NULL OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    ))
);

DROP POLICY IF EXISTS "contracts_insert" ON contracts;
CREATE POLICY "contracts_insert" ON contracts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = contracts.project_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "contracts_update" ON contracts;
CREATE POLICY "contracts_update" ON contracts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = contracts.project_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "contracts_delete" ON contracts;
CREATE POLICY "contracts_delete" ON contracts FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = contracts.project_id AND p.owner_id = auth.uid())
);

-- Amendments policies (via contract -> project)
DROP POLICY IF EXISTS "amendments_select" ON contract_amendments;
CREATE POLICY "amendments_select" ON contract_amendments FOR SELECT USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_amendments.contract_id AND (
        p.owner_id = auth.uid() OR p.owner_id IS NULL OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    ))
);

DROP POLICY IF EXISTS "amendments_insert" ON contract_amendments;
CREATE POLICY "amendments_insert" ON contract_amendments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_amendments.contract_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "amendments_update" ON contract_amendments;
CREATE POLICY "amendments_update" ON contract_amendments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_amendments.contract_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "amendments_delete" ON contract_amendments;
CREATE POLICY "amendments_delete" ON contract_amendments FOR DELETE USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_amendments.contract_id AND p.owner_id = auth.uid())
);

-- Drawdowns policies (same pattern)
DROP POLICY IF EXISTS "drawdowns_select" ON contract_drawdowns;
CREATE POLICY "drawdowns_select" ON contract_drawdowns FOR SELECT USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_drawdowns.contract_id AND (
        p.owner_id = auth.uid() OR p.owner_id IS NULL OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    ))
);

DROP POLICY IF EXISTS "drawdowns_insert" ON contract_drawdowns;
CREATE POLICY "drawdowns_insert" ON contract_drawdowns FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_drawdowns.contract_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "drawdowns_update" ON contract_drawdowns;
CREATE POLICY "drawdowns_update" ON contract_drawdowns FOR UPDATE USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_drawdowns.contract_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    ))
);

DROP POLICY IF EXISTS "drawdowns_delete" ON contract_drawdowns;
CREATE POLICY "drawdowns_delete" ON contract_drawdowns FOR DELETE USING (
    EXISTS (SELECT 1 FROM contracts c JOIN projects p ON p.id = c.project_id WHERE c.id = contract_drawdowns.contract_id AND p.owner_id = auth.uid())
);

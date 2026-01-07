-- Excel Indexer - Index Entries Table
-- This table stores code → description mappings for the Excel Indexer tool
-- Per-tenant data with RLS

-- Create table
CREATE TABLE IF NOT EXISTS public.excel_indexer_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_excel_indexer_entries_org_id ON public.excel_indexer_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_excel_indexer_entries_code ON public.excel_indexer_entries(code);

-- Enable RLS
ALTER TABLE public.excel_indexer_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see entries from their organization
CREATE POLICY "Users can view their organization's entries"
    ON public.excel_indexer_entries
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can insert entries for their organization
CREATE POLICY "Users can insert entries for their organization"
    ON public.excel_indexer_entries
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can update their organization's entries
CREATE POLICY "Users can update their organization's entries"
    ON public.excel_indexer_entries
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can delete their organization's entries
CREATE POLICY "Users can delete their organization's entries"
    ON public.excel_indexer_entries
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_excel_indexer_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_excel_indexer_entries_updated_at_trigger
    BEFORE UPDATE ON public.excel_indexer_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_excel_indexer_entries_updated_at();

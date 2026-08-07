-- Contract source documents and structured investor billing.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS document_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS document_file_name TEXT,
  ADD COLUMN IF NOT EXISTS document_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS document_size BIGINT;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_document_metadata_valid;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_document_metadata_valid CHECK (
    document_storage_path IS NULL
    OR (
      document_storage_path LIKE 'projects/' || project_id || '/contracts/%'
      AND
      document_storage_path ~ '^projects/[A-Za-z0-9-]+/contracts/[A-Za-z0-9-]+\.(pdf|docx)$'
      AND document_file_name IS NOT NULL
      AND document_mime_type IN (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      AND document_size BETWEEN 1 AND 20971520
    )
  );

ALTER TABLE public.project_investor_financials
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS contract_title TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_at DATE,
  ADD COLUMN IF NOT EXISTS retention_a_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_b_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_investor_financials
  DROP CONSTRAINT IF EXISTS project_investor_financials_retention_valid;
ALTER TABLE public.project_investor_financials
  ADD CONSTRAINT project_investor_financials_retention_valid CHECK (
    retention_a_percent BETWEEN 0 AND 100
    AND retention_b_percent BETWEEN 0 AND 100
    AND retention_a_percent + retention_b_percent <= 100
  );

ALTER TABLE public.project_amendments
  ADD COLUMN IF NOT EXISTS amendment_number TEXT,
  ADD COLUMN IF NOT EXISTS signed_at DATE;

ALTER TABLE public.project_investor_invoices
  ADD COLUMN IF NOT EXISTS period TEXT,
  ADD COLUMN IF NOT EXISTS retention_a_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_b_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_a_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_b_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

UPDATE public.project_investor_invoices
SET period = TO_CHAR(issue_date, 'YYYY-MM')
WHERE period IS NULL;

ALTER TABLE public.project_investor_invoices
  ALTER COLUMN period SET NOT NULL;

ALTER TABLE public.project_investor_invoices
  DROP CONSTRAINT IF EXISTS project_investor_invoices_period_valid,
  DROP CONSTRAINT IF EXISTS project_investor_invoices_retention_valid,
  DROP CONSTRAINT IF EXISTS project_investor_invoices_amount_breakdown_valid;
ALTER TABLE public.project_investor_invoices
  ADD CONSTRAINT project_investor_invoices_period_valid CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT project_investor_invoices_retention_valid CHECK (
    retention_a_percent BETWEEN 0 AND 100
    AND retention_b_percent BETWEEN 0 AND 100
    AND retention_a_percent + retention_b_percent <= 100
  ),
  ADD CONSTRAINT project_investor_invoices_amount_breakdown_valid CHECK (
    retention_a_amount >= 0
    AND retention_b_amount >= 0
    AND paid_amount >= 0
    AND retention_a_amount + retention_b_amount <= amount
    AND paid_amount <= amount - retention_a_amount - retention_b_amount
  );

ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select investor invoices via project" ON public.project_investor_invoices;
DROP POLICY IF EXISTS "Manage investor invoices via project" ON public.project_investor_invoices;

CREATE POLICY "Select investor invoices via project"
ON public.project_investor_invoices FOR SELECT TO authenticated
USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_investor_invoices.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Manage investor invoices via project"
ON public.project_investor_invoices FOR ALL TO authenticated
USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_investor_invoices.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
)
WITH CHECK (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_investor_invoices.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_investor_invoices TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('contract-documents', 'contract-documents', false, 20971520, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "contract_documents_select" ON storage.objects;
CREATE POLICY "contract_documents_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = split_part(name, '/', 2)
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "contract_documents_insert" ON storage.objects;
CREATE POLICY "contract_documents_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND split_part(name, '/', 4) ~ '^[A-Za-z0-9-]+\.(pdf|docx)$'
  AND public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = split_part(name, '/', 2)
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

DROP POLICY IF EXISTS "contract_documents_delete" ON storage.objects;
CREATE POLICY "contract_documents_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND split_part(name, '/', 1) = 'projects'
  AND split_part(name, '/', 3) = 'contracts'
  AND public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = split_part(name, '/', 2)
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

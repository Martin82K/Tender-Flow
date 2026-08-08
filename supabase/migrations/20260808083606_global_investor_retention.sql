-- NULL on an invoice retention percentage means that the invoice inherits the
-- project-wide percentage from project_investor_financials. Explicit values,
-- including zero, remain supported as per-invoice exceptions.
SET lock_timeout = '5s';

ALTER TABLE public.project_investor_invoices
  ALTER COLUMN retention_a_percent DROP DEFAULT,
  ALTER COLUMN retention_a_percent DROP NOT NULL,
  ALTER COLUMN retention_b_percent DROP DEFAULT,
  ALTER COLUMN retention_b_percent DROP NOT NULL;

-- Rows created by the previous UI contain a copy of the project defaults.
-- Convert only matching values to inheritance and preserve differing values as
-- legacy per-invoice exceptions.
UPDATE public.project_investor_invoices AS invoice
SET
  retention_a_percent = CASE
    WHEN invoice.retention_a_percent = financials.retention_a_percent THEN NULL
    ELSE invoice.retention_a_percent
  END,
  retention_b_percent = CASE
    WHEN invoice.retention_b_percent = financials.retention_b_percent THEN NULL
    ELSE invoice.retention_b_percent
  END
FROM public.project_investor_financials AS financials
WHERE financials.project_id = invoice.project_id
  AND (
    invoice.retention_a_percent = financials.retention_a_percent
    OR invoice.retention_b_percent = financials.retention_b_percent
  );

COMMENT ON COLUMN public.project_investor_invoices.retention_a_percent IS
  'Per-invoice retention A override; NULL inherits project_investor_financials.retention_a_percent.';
COMMENT ON COLUMN public.project_investor_invoices.retention_b_percent IS
  'Per-invoice retention B override; NULL inherits project_investor_financials.retention_b_percent.';

-- Keep the existing tenant-aware policies active; this migration does not
-- broaden grants or replace their ownership/share predicates.
ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY;

RESET lock_timeout;

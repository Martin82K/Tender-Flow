-- Manual retention planning registry for main CRM domains.

CREATE TABLE IF NOT EXISTS public.compliance_crm_retention_reviews (
  id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL UNIQUE,
  domain_label TEXT NOT NULL,
  retention_policy_id TEXT REFERENCES public.compliance_retention_policies(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'planned' CHECK (review_status IN ('planned', 'approved', 'blocked')),
  manual_workflow_summary TEXT NOT NULL DEFAULT '',
  next_review_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.compliance_crm_retention_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_crm_retention_reviews_admin_select" ON public.compliance_crm_retention_reviews;
CREATE POLICY "compliance_crm_retention_reviews_admin_select"
  ON public.compliance_crm_retention_reviews
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "compliance_crm_retention_reviews_admin_write" ON public.compliance_crm_retention_reviews;
CREATE POLICY "compliance_crm_retention_reviews_admin_write"
  ON public.compliance_crm_retention_reviews
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_crm_retention_reviews TO authenticated;
GRANT ALL ON public.compliance_crm_retention_reviews TO service_role;

INSERT INTO public.compliance_crm_retention_reviews (
  id,
  domain_key,
  domain_label,
  retention_policy_id,
  review_status,
  manual_workflow_summary,
  next_review_at
)
VALUES
  (
    'crm-retention-projects',
    'projects',
    'Projekty a projektové poznámky',
    'contacts-projects',
    'planned',
    'Ruční retenční review nad dokončenými a archivovanými projekty. Bez automatického mazání; nejdřív ověřit smluvní, účetní a realizační důvody pro další držení dat.',
    DATE '2026-04-15'
  ),
  (
    'crm-retention-subcontractors',
    'subcontractors',
    'Subdodavatelé a kontaktní osoby',
    'contacts-projects',
    'planned',
    'Ruční review kontaktů a firem bez aktivní vazby na běžící zakázky. Před případnou anonymizací zkontrolovat obchodní historii a otevřené smlouvy.',
    DATE '2026-04-15'
  ),
  (
    'crm-retention-contracts',
    'contracts',
    'Smlouvy, dodatky a čerpání',
    'account-contracts',
    'approved',
    'Smluvní a účetní agenda se drží podle zákonné a smluvní retence. Po uplynutí lhůty má následovat ruční právní kontrola před jakýmkoli odstraněním.',
    DATE '2026-06-30'
  ),
  (
    'crm-retention-project-shares',
    'project_shares',
    'Sdílení projektů a přístupy třetích stran',
    'support-requests',
    'planned',
    'Ruční kontrola sdílení a přístupů po ukončení spolupráce. Cílem je včas stáhnout neaktivní sdílení bez zásahu do samotného projektu.',
    DATE '2026-04-01'
  ),
  (
    'crm-retention-tender-plans',
    'tender_plans',
    'Tender plány a harmonogramy',
    'contacts-projects',
    'planned',
    'Ruční review plánovacích dat navázaných na uzavřené nebo zrušené zakázky. Automatické mazání je vypnuté, zůstává jen evidenční plán ručního postupu.',
    DATE '2026-04-15'
  )
ON CONFLICT (id) DO UPDATE
SET
  domain_key = EXCLUDED.domain_key,
  domain_label = EXCLUDED.domain_label,
  retention_policy_id = EXCLUDED.retention_policy_id,
  review_status = EXCLUDED.review_status,
  manual_workflow_summary = EXCLUDED.manual_workflow_summary,
  next_review_at = EXCLUDED.next_review_at,
  updated_at = timezone('utc'::text, now());

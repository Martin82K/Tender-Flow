-- Extend manual retention registry to document, export and backup-adjacent domains.

INSERT INTO public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
VALUES
  (
    'document-storage',
    'Nahrané dokumenty a DocHub vazby',
    'Uživatelské dokumenty, odkazy na dokumentové struktury a související metadata',
    1095,
    'partial',
    'Retence je řízena manuálním review workflow; automatické mazání dokumentových domén je zatím vypnuté.'
  ),
  (
    'generated-exports',
    'Generované exporty a dočasné artefakty',
    'Dočasné exportní soubory, JSON/PDF/XLSX artefakty a lokální přechodné výstupy',
    30,
    'partial',
    'Retence je zatím jen manuálně řízená; uživatel rozhoduje o finálním odstranění.'
  ),
  (
    'backup-artifacts',
    'Zálohy a archivní artefakty',
    'Ruční zálohy, archivní kopie a dlouhodobě držené exportní snapshoty mimo hlavní runtime',
    30,
    'partial',
    'Vyžaduje finální provozní směrnici a ruční review; bez automatického mazání.'
  )
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  retention_days = EXCLUDED.retention_days,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

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
    'crm-retention-dochub-links',
    'dochub_project_folders',
    'DocHub projektové složky a vazby na dokumenty',
    'document-storage',
    'planned',
    'Ruční retenční review vazeb na externí dokumentová úložiště po archivaci nebo smazání projektu. Automatické odpojování je vypnuté, nejdřív se má ověřit, zda dokumenty nejsou stále potřeba pro smluvní nebo realizační účely.',
    DATE '2026-04-20'
  ),
  (
    'crm-retention-uploaded-documents',
    'uploaded_documents',
    'Nahrané dokumenty v úložišti',
    'document-storage',
    'planned',
    'Ruční kontrola nahraných dokumentů a jejich vazby na aktivní zakázky. Bez automatického mazání; po retenční lhůtě má následovat ruční rozhodnutí nad konkrétní složkou nebo projektem.',
    DATE '2026-04-20'
  ),
  (
    'crm-retention-generated-exports',
    'generated_exports',
    'Generované exporty a dočasné soubory',
    'generated-exports',
    'planned',
    'Ruční review exportních artefaktů vytvářených při DSR, reportingu a kancelářských exportech. Cílem je omezit dlouhodobé držení kopií mimo hlavní datový model, ale mazání zůstává výhradně ruční.',
    DATE '2026-03-31'
  ),
  (
    'crm-retention-backup-artifacts',
    'backup_artifacts',
    'Zálohy a archivní artefakty mimo hlavní runtime',
    'backup-artifacts',
    'blocked',
    'Ruční retenční plán je připraven, ale finální rozhodování blokuje chybějící provozní směrnice k zálohám a obnově. Bez jejich schválení se žádné mazání ani rotace automaticky nespouští.',
    DATE '2026-04-30'
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

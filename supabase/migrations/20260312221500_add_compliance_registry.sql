-- Compliance registry backbone for admin workflows.

CREATE TABLE IF NOT EXISTS public.compliance_checklist_items (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('implemented', 'partial', 'missing')),
  priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.compliance_retention_policies (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  retention_days INTEGER NOT NULL DEFAULT 0 CHECK (retention_days >= 0),
  status TEXT NOT NULL CHECK (status IN ('implemented', 'partial', 'missing')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'export', 'rectification', 'erasure')),
  subject_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'completed')),
  due_at DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.breach_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('triage', 'assessment', 'reported', 'closed')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  linked_incident_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.subprocessors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'n/a',
  purpose TEXT NOT NULL DEFAULT '',
  transfer_mechanism TEXT NOT NULL DEFAULT 'n/a',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.compliance_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprocessors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_checklist_items_admin_select" ON public.compliance_checklist_items;
CREATE POLICY "compliance_checklist_items_admin_select"
  ON public.compliance_checklist_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "compliance_checklist_items_admin_write" ON public.compliance_checklist_items;
CREATE POLICY "compliance_checklist_items_admin_write"
  ON public.compliance_checklist_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "compliance_retention_policies_admin_select" ON public.compliance_retention_policies;
CREATE POLICY "compliance_retention_policies_admin_select"
  ON public.compliance_retention_policies
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "compliance_retention_policies_admin_write" ON public.compliance_retention_policies;
CREATE POLICY "compliance_retention_policies_admin_write"
  ON public.compliance_retention_policies
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "data_subject_requests_admin_select" ON public.data_subject_requests;
CREATE POLICY "data_subject_requests_admin_select"
  ON public.data_subject_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "data_subject_requests_admin_write" ON public.data_subject_requests;
CREATE POLICY "data_subject_requests_admin_write"
  ON public.data_subject_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "breach_cases_admin_select" ON public.breach_cases;
CREATE POLICY "breach_cases_admin_select"
  ON public.breach_cases
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "breach_cases_admin_write" ON public.breach_cases;
CREATE POLICY "breach_cases_admin_write"
  ON public.breach_cases
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subprocessors_admin_select" ON public.subprocessors;
CREATE POLICY "subprocessors_admin_select"
  ON public.subprocessors
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "subprocessors_admin_write" ON public.subprocessors;
CREATE POLICY "subprocessors_admin_write"
  ON public.subprocessors
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_retention_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_subject_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breach_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subprocessors TO authenticated;

GRANT ALL ON public.compliance_checklist_items TO service_role;
GRANT ALL ON public.compliance_retention_policies TO service_role;
GRANT ALL ON public.data_subject_requests TO service_role;
GRANT ALL ON public.breach_cases TO service_role;
GRANT ALL ON public.subprocessors TO service_role;

INSERT INTO public.compliance_checklist_items (id, area, title, description, status, priority)
VALUES
  ('log-policy', 'Logování', 'Sdílená sanitizace logů', 'Citlivé hodnoty se redigují jednotným helperem napříč runtime diagnostics a incident loggerem.', 'implemented', 'P0'),
  ('breach-register', 'Incidenty', 'Breach register', 'Chybí oddělený workflow pro GDPR breach a právní klasifikaci incidentu.', 'missing', 'P0'),
  ('retention', 'Retence', 'Centrální retention matrix', 'Incident logy už mají purge, ale ostatní datové domény zatím ne.', 'partial', 'P0'),
  ('dsr', 'DSR', 'Subjektové požadavky', 'Existují dílčí exporty, ale chybí centrální access/export/delete workflow.', 'partial', 'P0'),
  ('mfa', 'Přístupy', 'MFA enforcement pro adminy', 'Desktop biometrie existuje, ale není to compliance MFA enforcement.', 'partial', 'P1'),
  ('cookie-consent', 'Souhlasy', 'Cookie consent vrstva', 'Cookie policy stránka existuje, ale chybí reálný consent manager.', 'missing', 'P1')
ON CONFLICT (id) DO UPDATE
SET
  area = EXCLUDED.area,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
VALUES
  ('incident-logs', 'Incident logy', 'Diagnostika a bezpečnostní dohled', 60, 'implemented', 'Navázáno na existující purge job pro app incidenty.'),
  ('runtime-diagnostics', 'Runtime diagnostics', 'Krátkodobá lokální diagnostika klienta', 0, 'partial', 'Centrální retence zatím není zavedena.'),
  ('contacts-projects', 'Kontakty a projektová data', 'Obchodní a realizační agenda', 0, 'missing', 'Čeká na retention matrix a purge/anonymize workflow.')
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  retention_days = EXCLUDED.retention_days,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.data_subject_requests (id, request_type, subject_label, status, due_at, notes)
VALUES
  ('DSR-BOOTSTRAP-1', 'export', 'Připravit centrální export osobních údajů', 'new', DATE '2026-03-19', 'Bootstrap položka pro první implementační fázi.'),
  ('DSR-BOOTSTRAP-2', 'erasure', 'Navrhnout delete/anonymize orchestraci', 'in_progress', DATE '2026-03-22', 'Bootstrap položka pro první implementační fázi.')
ON CONFLICT (id) DO UPDATE
SET
  request_type = EXCLUDED.request_type,
  subject_label = EXCLUDED.subject_label,
  status = EXCLUDED.status,
  due_at = EXCLUDED.due_at,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.breach_cases (id, title, status, risk_level, linked_incident_id, notes)
VALUES
  ('BREACH-BOOTSTRAP-1', 'Oddělit runtime incidenty od GDPR breach case', 'triage', 'high', NULL, 'Bootstrap položka pro první implementační fázi.')
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  linked_incident_id = EXCLUDED.linked_incident_id,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.subprocessors (id, name, region, purpose, transfer_mechanism, notes)
VALUES
  ('subprocessors-missing', 'Registry zatím není zaveden', 'n/a', 'Doplnit v další fázi', 'n/a', 'Bootstrap placeholder pro admin compliance přehled.')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  region = EXCLUDED.region,
  purpose = EXCLUDED.purpose,
  transfer_mechanism = EXCLUDED.transfer_mechanism,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

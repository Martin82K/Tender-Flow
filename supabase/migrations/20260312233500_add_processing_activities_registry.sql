-- ROPA / processing activities registry for compliance admin.

CREATE TABLE IF NOT EXISTS public.processing_activities (
  id TEXT PRIMARY KEY,
  activity_name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  legal_basis TEXT NOT NULL DEFAULT '',
  data_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  retention_policy_id TEXT REFERENCES public.compliance_retention_policies(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.processing_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "processing_activities_admin_select" ON public.processing_activities;
CREATE POLICY "processing_activities_admin_select"
  ON public.processing_activities
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "processing_activities_admin_write" ON public.processing_activities;
CREATE POLICY "processing_activities_admin_write"
  ON public.processing_activities
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_activities TO authenticated;
GRANT ALL ON public.processing_activities TO service_role;

INSERT INTO public.processing_activities (
  id,
  activity_name,
  purpose,
  legal_basis,
  data_categories,
  retention_policy_id,
  notes
)
VALUES (
  'processing-activities-missing',
  'Registr činností zatím není doplněn',
  'Doplnit v další fázi',
  'n/a',
  ARRAY['n/a'],
  NULL,
  'Bootstrap placeholder pro první fázi ROPA evidence.'
)
ON CONFLICT (id) DO UPDATE
SET
  activity_name = EXCLUDED.activity_name,
  purpose = EXCLUDED.purpose,
  legal_basis = EXCLUDED.legal_basis,
  data_categories = EXCLUDED.data_categories,
  retention_policy_id = EXCLUDED.retention_policy_id,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.compliance_checklist_items (id, area, title, description, status, priority)
VALUES (
  'ropa',
  'ROPA',
  'Záznamy o činnostech zpracování',
  'Je potřeba centrální evidence účelů, právních titulů, kategorií dat a vazeb na retenci.',
  'partial',
  'P1'
)
ON CONFLICT (id) DO UPDATE
SET
  area = EXCLUDED.area,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  updated_at = timezone('utc'::text, now());

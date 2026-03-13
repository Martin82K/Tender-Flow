-- Link ROPA processing activities to subprocessors for compliance mapping.

CREATE TABLE IF NOT EXISTS public.processing_activity_subprocessors (
  processing_activity_id TEXT NOT NULL REFERENCES public.processing_activities(id) ON DELETE CASCADE,
  subprocessor_id TEXT NOT NULL REFERENCES public.subprocessors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (processing_activity_id, subprocessor_id)
);

ALTER TABLE public.processing_activity_subprocessors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "processing_activity_subprocessors_admin_select" ON public.processing_activity_subprocessors;
CREATE POLICY "processing_activity_subprocessors_admin_select"
  ON public.processing_activity_subprocessors
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "processing_activity_subprocessors_admin_write" ON public.processing_activity_subprocessors;
CREATE POLICY "processing_activity_subprocessors_admin_write"
  ON public.processing_activity_subprocessors
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_activity_subprocessors TO authenticated;
GRANT ALL ON public.processing_activity_subprocessors TO service_role;

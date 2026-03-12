-- Compliance retention runtime: events timeline and purge helper.

CREATE TABLE IF NOT EXISTS public.data_subject_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL REFERENCES public.data_subject_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.breach_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_case_id TEXT NOT NULL REFERENCES public.breach_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.data_subject_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_subject_request_events_admin_select" ON public.data_subject_request_events;
CREATE POLICY "data_subject_request_events_admin_select"
  ON public.data_subject_request_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "data_subject_request_events_admin_write" ON public.data_subject_request_events;
CREATE POLICY "data_subject_request_events_admin_write"
  ON public.data_subject_request_events
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "breach_case_events_admin_select" ON public.breach_case_events;
CREATE POLICY "breach_case_events_admin_select"
  ON public.breach_case_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "breach_case_events_admin_write" ON public.breach_case_events;
CREATE POLICY "breach_case_events_admin_write"
  ON public.breach_case_events
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_subject_request_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breach_case_events TO authenticated;
GRANT ALL ON public.data_subject_request_events TO service_role;
GRANT ALL ON public.breach_case_events TO service_role;

INSERT INTO public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
VALUES
  ('admin-audit-events', 'Admin audit events', 'Audit citlivých administrativních akcí', 180, 'implemented', 'Mazání přes compliance purge helper.'),
  ('data-subject-request-events', 'DSR events', 'Timeline požadavků subjektů údajů', 365, 'implemented', 'Mazání jen uzavřených nebo dokončených případů.'),
  ('breach-case-events', 'Breach events', 'Timeline GDPR incidentů a breach případů', 365, 'implemented', 'Mazání jen uzavřených breach případů.')
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  retention_days = EXCLUDED.retention_days,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION public.run_compliance_retention_purge_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_audit_days INTEGER := 180;
  v_dsr_days INTEGER := 365;
  v_breach_days INTEGER := 365;
  v_admin_audit_deleted BIGINT := 0;
  v_dsr_deleted BIGINT := 0;
  v_breach_deleted BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT retention_days
    INTO v_admin_audit_days
  FROM public.compliance_retention_policies
  WHERE id = 'admin-audit-events';

  SELECT retention_days
    INTO v_dsr_days
  FROM public.compliance_retention_policies
  WHERE id = 'data-subject-request-events';

  SELECT retention_days
    INTO v_breach_days
  FROM public.compliance_retention_policies
  WHERE id = 'breach-case-events';

  DELETE FROM public.admin_audit_events
  WHERE created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_admin_audit_days, 180), 1));
  GET DIAGNOSTICS v_admin_audit_deleted = ROW_COUNT;

  DELETE FROM public.data_subject_request_events e
  USING public.data_subject_requests r
  WHERE e.request_id = r.id
    AND r.status = 'completed'
    AND e.created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_dsr_days, 365), 1));
  GET DIAGNOSTICS v_dsr_deleted = ROW_COUNT;

  DELETE FROM public.breach_case_events e
  USING public.breach_cases b
  WHERE e.breach_case_id = b.id
    AND b.status = 'closed'
    AND e.created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_breach_days, 365), 1));
  GET DIAGNOSTICS v_breach_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_audit_deleted', v_admin_audit_deleted,
    'dsr_events_deleted', v_dsr_deleted,
    'breach_events_deleted', v_breach_deleted,
    'completed_at', timezone('utc'::text, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;

  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'run_compliance_retention_purge_admin_daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'run_compliance_retention_purge_admin_daily',
    '41 3 * * *',
    'select public.run_compliance_retention_purge_admin();'
  );
END $$;

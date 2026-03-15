-- Repair migration for compliance schema on environments where earlier
-- compliance migrations were not applied or PostgREST schema cache is stale.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

ALTER TABLE public.data_subject_requests
  ADD COLUMN IF NOT EXISTS requester_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intake_channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT NOT NULL DEFAULT '';

ALTER TABLE public.data_subject_requests
  DROP CONSTRAINT IF EXISTS data_subject_requests_intake_channel_check;

ALTER TABLE public.data_subject_requests
  ADD CONSTRAINT data_subject_requests_intake_channel_check
  CHECK (intake_channel IN ('email', 'form', 'phone', 'support', 'internal'));

ALTER TABLE public.data_subject_requests
  DROP CONSTRAINT IF EXISTS data_subject_requests_verification_status_check;

ALTER TABLE public.data_subject_requests
  ADD CONSTRAINT data_subject_requests_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'not_required'));

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

ALTER TABLE public.breach_cases
  ADD COLUMN IF NOT EXISTS assessment_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS affected_data_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS affected_subject_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS estimated_subject_count INTEGER,
  ADD COLUMN IF NOT EXISTS notification_rationale TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS authority_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_subjects_notified_at TIMESTAMPTZ;

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

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

CREATE TABLE IF NOT EXISTS public.processing_activity_subprocessors (
  processing_activity_id TEXT NOT NULL REFERENCES public.processing_activities(id) ON DELETE CASCADE,
  subprocessor_id TEXT NOT NULL REFERENCES public.subprocessors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (processing_activity_id, subprocessor_id)
);

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

CREATE TABLE IF NOT EXISTS public.role_permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'user_role_changed',
      'org_role_changed',
      'role_permission_changed',
      'access_review_completed'
    )
  ),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_role_id TEXT,
  permission_key TEXT,
  old_value TEXT,
  new_value TEXT,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.access_review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_scope TEXT NOT NULL DEFAULT 'all_admin_access',
  summary TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_users INTEGER NOT NULL DEFAULT 0,
  admin_users INTEGER NOT NULL DEFAULT 0,
  stale_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_role_permission_audit_log_created_at
  ON public.role_permission_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_review_reports_created_at
  ON public.access_review_reports(created_at DESC);

ALTER TABLE public.compliance_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_activity_subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_crm_retention_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_review_reports ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "admin_audit_events_admin_select" ON public.admin_audit_events;
CREATE POLICY "admin_audit_events_admin_select"
  ON public.admin_audit_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_events_admin_insert" ON public.admin_audit_events;
CREATE POLICY "admin_audit_events_admin_insert"
  ON public.admin_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

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

DROP POLICY IF EXISTS "role_permission_audit_log_admin_select" ON public.role_permission_audit_log;
CREATE POLICY "role_permission_audit_log_admin_select"
  ON public.role_permission_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "role_permission_audit_log_admin_insert" ON public.role_permission_audit_log;
CREATE POLICY "role_permission_audit_log_admin_insert"
  ON public.role_permission_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "access_review_reports_admin_select" ON public.access_review_reports;
CREATE POLICY "access_review_reports_admin_select"
  ON public.access_review_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "access_review_reports_admin_insert" ON public.access_review_reports;
CREATE POLICY "access_review_reports_admin_insert"
  ON public.access_review_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_retention_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_subject_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breach_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subprocessors TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_subject_request_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breach_case_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_activity_subprocessors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_crm_retention_reviews TO authenticated;
GRANT SELECT, INSERT ON public.role_permission_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.access_review_reports TO authenticated;

GRANT ALL ON public.compliance_checklist_items TO service_role;
GRANT ALL ON public.compliance_retention_policies TO service_role;
GRANT ALL ON public.data_subject_requests TO service_role;
GRANT ALL ON public.breach_cases TO service_role;
GRANT ALL ON public.subprocessors TO service_role;
GRANT ALL ON public.admin_audit_events TO service_role;
GRANT ALL ON public.data_subject_request_events TO service_role;
GRANT ALL ON public.breach_case_events TO service_role;
GRANT ALL ON public.processing_activities TO service_role;
GRANT ALL ON public.processing_activity_subprocessors TO service_role;
GRANT ALL ON public.compliance_crm_retention_reviews TO service_role;
GRANT ALL ON public.role_permission_audit_log TO service_role;
GRANT ALL ON public.access_review_reports TO service_role;

CREATE OR REPLACE FUNCTION public.log_role_permission_audit_event(
  p_event_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_role_id TEXT DEFAULT NULL,
  p_permission_key TEXT DEFAULT NULL,
  p_old_value TEXT DEFAULT NULL,
  p_new_value TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  INSERT INTO public.role_permission_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    target_role_id,
    permission_key,
    old_value,
    new_value,
    summary
  ) VALUES (
    p_event_type,
    auth.uid(),
    p_target_user_id,
    p_target_role_id,
    p_permission_key,
    p_old_value,
    p_new_value,
    p_summary
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_access_review_overview_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users JSONB := '[]'::jsonb;
  v_audit JSONB := '[]'::jsonb;
  v_reviews JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'email', t.email,
        'display_name', t.display_name,
        'app_role_id', t.role_id,
        'app_role_label', t.role_label,
        'org_roles', t.org_roles,
        'last_sign_in', t.last_sign_in,
        'risk_flags', t.risk_flags
      )
      ORDER BY t.email
    ),
    '[]'::jsonb
  )
  INTO v_users
  FROM (
    SELECT
      au.id AS user_id,
      au.email::TEXT AS email,
      COALESCE(up.display_name, '')::TEXT AS display_name,
      up.role_id::TEXT AS role_id,
      ur.label::TEXT AS role_label,
      COALESCE(array_agg(DISTINCT om.role::TEXT) FILTER (WHERE om.role IS NOT NULL), ARRAY[]::TEXT[]) AS org_roles,
      au.last_sign_in_at AS last_sign_in,
      ARRAY_REMOVE(ARRAY[
        CASE
          WHEN au.last_sign_in_at IS NULL OR au.last_sign_in_at < timezone('utc'::text, now()) - interval '90 days'
            THEN 'stale_account'
          ELSE NULL
        END,
        CASE
          WHEN public.is_admin_email(au.email::TEXT) OR up.role_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.organization_members om2
            WHERE om2.user_id = au.id
              AND om2.role IN ('owner', 'admin')
          )
            THEN 'privileged_access'
          ELSE NULL
        END
      ], NULL) AS risk_flags
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.user_id = au.id
    LEFT JOIN public.user_roles ur ON ur.id = up.role_id
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    GROUP BY au.id, au.email, up.display_name, up.role_id, ur.label, au.last_sign_in_at
  ) AS t;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'event_type', l.event_type,
        'actor_email', actor.email,
        'target_user_email', target_user.email,
        'target_role_id', l.target_role_id,
        'permission_key', l.permission_key,
        'old_value', l.old_value,
        'new_value', l.new_value,
        'summary', l.summary,
        'created_at', l.created_at
      )
      ORDER BY l.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_audit
  FROM (
    SELECT *
    FROM public.role_permission_audit_log
    ORDER BY created_at DESC
    LIMIT 25
  ) l
  LEFT JOIN auth.users actor ON actor.id = l.actor_user_id
  LEFT JOIN auth.users target_user ON target_user.id = l.target_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'review_scope', r.review_scope,
        'summary', r.summary,
        'reviewed_by_email', reviewer.email,
        'total_users', r.total_users,
        'admin_users', r.admin_users,
        'stale_users', r.stale_users,
        'created_at', r.created_at
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_reviews
  FROM (
    SELECT *
    FROM public.access_review_reports
    ORDER BY created_at DESC
    LIMIT 10
  ) r
  LEFT JOIN auth.users reviewer ON reviewer.id = r.reviewed_by;

  RETURN jsonb_build_object(
    'users', v_users,
    'audit_entries', v_audit,
    'review_reports', v_reviews
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_access_review_report_admin(
  review_scope_input TEXT DEFAULT 'all_admin_access',
  summary_input TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_total_users INTEGER := 0;
  v_admin_users INTEGER := 0;
  v_stale_users INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT COUNT(*)
    INTO v_total_users
  FROM auth.users;

  SELECT COUNT(*)
    INTO v_admin_users
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id
  WHERE public.is_admin_email(au.email::TEXT)
     OR up.role_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM public.organization_members om
       WHERE om.user_id = au.id
         AND om.role IN ('owner', 'admin')
     );

  SELECT COUNT(*)
    INTO v_stale_users
  FROM auth.users au
  WHERE au.last_sign_in_at IS NULL
     OR au.last_sign_in_at < timezone('utc'::text, now()) - interval '90 days';

  INSERT INTO public.access_review_reports (
    review_scope,
    summary,
    reviewed_by,
    total_users,
    admin_users,
    stale_users
  ) VALUES (
    COALESCE(NULLIF(trim(review_scope_input), ''), 'all_admin_access'),
    COALESCE(summary_input, ''),
    auth.uid(),
    v_total_users,
    v_admin_users,
    v_stale_users
  )
  RETURNING id INTO v_id;

  PERFORM public.log_role_permission_audit_event(
    'access_review_completed',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    format('Dokončena access review: %s', COALESCE(NULLIF(trim(summary_input), ''), 'bez poznámky'))
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_role_permission_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_review_overview_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_access_review_report_admin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_role_permission_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_access_review_overview_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_access_review_report_admin(TEXT, TEXT) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

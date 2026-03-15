-- Repair access review resources for environments where the RPC migration
-- was skipped before compliance bootstrap was applied.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

ALTER TABLE public.role_permission_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_review_reports ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT ON public.role_permission_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.access_review_reports TO authenticated;
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

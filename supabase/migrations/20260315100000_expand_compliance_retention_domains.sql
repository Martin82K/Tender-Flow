-- Expand compliance retention runtime to additional short-lived domains.

INSERT INTO public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
VALUES
  (
    'notifications',
    'Uživatelské notifikace',
    'Krátkodobé produktové notifikace a provozní upozornění v aplikaci',
    5,
    'implemented',
    'Krátká retence navázaná na cleanup notifikací.'
  ),
  (
    'password-reset-tokens',
    'Password reset tokeny',
    'Jednorázové tokeny pro reset hesla a související bezpečnostní workflow',
    2,
    'implemented',
    'Mažou se jen expirované nebo použité tokeny po krátké bezpečnostní lhůtě.'
  )
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  retention_days = EXCLUDED.retention_days,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_tokens()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT := 0;
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < timezone('utc'::text, now()) - interval '2 hours'
     OR (
       used_at IS NOT NULL
       AND used_at < timezone('utc'::text, now()) - interval '2 days'
     );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_password_reset_tokens() TO service_role;

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
  v_notification_days INTEGER := 5;
  v_admin_audit_deleted BIGINT := 0;
  v_dsr_deleted BIGINT := 0;
  v_breach_deleted BIGINT := 0;
  v_notifications_deleted BIGINT := 0;
  v_password_reset_deleted BIGINT := 0;
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

  SELECT retention_days
    INTO v_notification_days
  FROM public.compliance_retention_policies
  WHERE id = 'notifications';

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

  DELETE FROM public.notifications
  WHERE created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_notification_days, 5), 1));
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  SELECT public.cleanup_expired_password_reset_tokens()
    INTO v_password_reset_deleted;

  RETURN jsonb_build_object(
    'admin_audit_deleted', v_admin_audit_deleted,
    'dsr_events_deleted', v_dsr_deleted,
    'breach_events_deleted', v_breach_deleted,
    'notifications_deleted', v_notifications_deleted,
    'password_reset_tokens_deleted', v_password_reset_deleted,
    'completed_at', timezone('utc'::text, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO service_role;

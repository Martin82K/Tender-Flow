-- Expand compliance retention to telemetry and usage domains.

INSERT INTO public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
VALUES
  (
    'feature-usage-events',
    'Feature usage telemetry',
    'Agregace využití funkcí po organizacích pro produktové a billing rozhodování',
    180,
    'implemented',
    'Krátkodobá telemetry retention nad feature usage eventy.'
  ),
  (
    'ai-agent-usage-events',
    'AI agent telemetry',
    'Provozní a nákladová telemetry AI asistenta včetně tokenů a guard rozhodnutí',
    180,
    'implemented',
    'Retence omezuje dobu držení detailní AI telemetry.'
  ),
  (
    'ai-voice-usage-events',
    'AI voice telemetry',
    'Provozní a nákladová telemetry speech/transcribe funkcí',
    180,
    'implemented',
    'Retence omezuje dobu držení voice usage telemetry.'
  )
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
  v_notification_days INTEGER := 5;
  v_feature_usage_days INTEGER := 180;
  v_ai_agent_usage_days INTEGER := 180;
  v_ai_voice_usage_days INTEGER := 180;
  v_admin_audit_deleted BIGINT := 0;
  v_dsr_deleted BIGINT := 0;
  v_breach_deleted BIGINT := 0;
  v_notifications_deleted BIGINT := 0;
  v_password_reset_deleted BIGINT := 0;
  v_feature_usage_deleted BIGINT := 0;
  v_ai_agent_usage_deleted BIGINT := 0;
  v_ai_voice_usage_deleted BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT retention_days INTO v_admin_audit_days
  FROM public.compliance_retention_policies
  WHERE id = 'admin-audit-events';

  SELECT retention_days INTO v_dsr_days
  FROM public.compliance_retention_policies
  WHERE id = 'data-subject-request-events';

  SELECT retention_days INTO v_breach_days
  FROM public.compliance_retention_policies
  WHERE id = 'breach-case-events';

  SELECT retention_days INTO v_notification_days
  FROM public.compliance_retention_policies
  WHERE id = 'notifications';

  SELECT retention_days INTO v_feature_usage_days
  FROM public.compliance_retention_policies
  WHERE id = 'feature-usage-events';

  SELECT retention_days INTO v_ai_agent_usage_days
  FROM public.compliance_retention_policies
  WHERE id = 'ai-agent-usage-events';

  SELECT retention_days INTO v_ai_voice_usage_days
  FROM public.compliance_retention_policies
  WHERE id = 'ai-voice-usage-events';

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

  DELETE FROM public.feature_usage_events
  WHERE created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_feature_usage_days, 180), 1));
  GET DIAGNOSTICS v_feature_usage_deleted = ROW_COUNT;

  DELETE FROM public.ai_agent_usage_events
  WHERE created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_ai_agent_usage_days, 180), 1));
  GET DIAGNOSTICS v_ai_agent_usage_deleted = ROW_COUNT;

  DELETE FROM public.ai_voice_usage_events
  WHERE created_at < timezone('utc'::text, now()) - make_interval(days => GREATEST(COALESCE(v_ai_voice_usage_days, 180), 1));
  GET DIAGNOSTICS v_ai_voice_usage_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_audit_deleted', v_admin_audit_deleted,
    'dsr_events_deleted', v_dsr_deleted,
    'breach_events_deleted', v_breach_deleted,
    'notifications_deleted', v_notifications_deleted,
    'password_reset_tokens_deleted', v_password_reset_deleted,
    'feature_usage_deleted', v_feature_usage_deleted,
    'ai_agent_usage_deleted', v_ai_agent_usage_deleted,
    'ai_voice_usage_deleted', v_ai_voice_usage_deleted,
    'completed_at', timezone('utc'::text, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO service_role;

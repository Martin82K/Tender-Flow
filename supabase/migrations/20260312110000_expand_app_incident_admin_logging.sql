-- Expand admin incident logs with user email and richer operational context.

CREATE OR REPLACE FUNCTION public.log_app_incident(input JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_incident_id TEXT;
  v_occurred_at TIMESTAMPTZ;
  v_id UUID;
  v_context JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: authenticated user required';
  END IF;

  SELECT om.organization_id
  INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    om.created_at,
    om.organization_id
  LIMIT 1;

  v_incident_id := left(COALESCE(input->>'incident_id', gen_random_uuid()::text), 64);

  BEGIN
    v_occurred_at := COALESCE((input->>'occurred_at')::timestamptz, timezone('utc'::text, now()));
  EXCEPTION
    WHEN OTHERS THEN
      v_occurred_at := timezone('utc'::text, now());
  END;

  v_context := jsonb_strip_nulls(
    jsonb_build_object(
      'route', public.sanitize_incident_text(input#>>'{context,route}', 256),
      'action', public.sanitize_incident_text(input#>>'{context,action}', 256),
      'feature', public.sanitize_incident_text(input#>>'{context,feature}', 256),
      'operation', public.sanitize_incident_text(input#>>'{context,operation}', 256),
      'function_name', public.sanitize_incident_text(input#>>'{context,function_name}', 128),
      'http_status', NULLIF(input#>>'{context,http_status}', ''),
      'retry_count', NULLIF(input#>>'{context,retry_count}', ''),
      'provider', public.sanitize_incident_text(input#>>'{context,provider}', 128),
      'reason', public.sanitize_incident_text(input#>>'{context,reason}', 512),
      'release_channel', public.sanitize_incident_text(input#>>'{context,release_channel}', 64),
      'platform', public.sanitize_incident_text(input#>>'{context,platform}', 64),
      'os', public.sanitize_incident_text(input#>>'{context,os}', 64),
      'user_id', public.sanitize_incident_text(input#>>'{context,user_id}', 64),
      'organization_id', public.sanitize_incident_text(input#>>'{context,organization_id}', 64),
      'project_id', public.sanitize_incident_text(input#>>'{context,project_id}', 64),
      'category_id', public.sanitize_incident_text(input#>>'{context,category_id}', 64),
      'entity_id', public.sanitize_incident_text(input#>>'{context,entity_id}', 128),
      'entity_type', public.sanitize_incident_text(input#>>'{context,entity_type}', 128),
      'folder_path', public.sanitize_incident_text(input#>>'{context,folder_path}', 512),
      'target_path', public.sanitize_incident_text(input#>>'{context,target_path}', 512),
      'action_status', public.sanitize_incident_text(input#>>'{context,action_status}', 64)
    )
  );

  INSERT INTO public.app_incident_events (
    incident_id,
    occurred_at,
    severity,
    source,
    category,
    code,
    message,
    stack,
    fingerprint,
    app_version,
    release_channel,
    platform,
    os,
    route,
    session_id,
    user_id,
    organization_id,
    context
  )
  VALUES (
    v_incident_id,
    v_occurred_at,
    CASE
      WHEN lower(COALESCE(input->>'severity', '')) IN ('error', 'warn', 'info')
        THEN lower(input->>'severity')
      ELSE 'error'
    END,
    CASE
      WHEN lower(COALESCE(input->>'source', '')) IN ('renderer', 'desktop-main', 'supabase-client', 'react-query')
        THEN lower(input->>'source')
      ELSE 'renderer'
    END,
    CASE
      WHEN lower(COALESCE(input->>'category', '')) IN ('auth', 'network', 'ui', 'runtime', 'storage')
        THEN lower(input->>'category')
      ELSE 'runtime'
    END,
    upper(public.sanitize_incident_text(input->>'code', 128)),
    public.sanitize_incident_text(input->>'message', 2000),
    NULLIF(public.sanitize_incident_text(input->>'stack', 4000), ''),
    public.sanitize_incident_text(input->>'fingerprint', 128),
    public.sanitize_incident_text(input->>'app_version', 64),
    public.sanitize_incident_text(input->>'release_channel', 64),
    CASE
      WHEN lower(COALESCE(input->>'platform', '')) IN ('desktop', 'web')
        THEN lower(input->>'platform')
      ELSE 'web'
    END,
    public.sanitize_incident_text(input->>'os', 64),
    public.sanitize_incident_text(input->>'route', 256),
    public.sanitize_incident_text(input->>'session_id', 128),
    v_user_id,
    v_org_id,
    v_context
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_incidents_admin(
  incident_id_filter TEXT DEFAULT NULL,
  user_id_filter UUID DEFAULT NULL,
  email_filter TEXT DEFAULT NULL,
  action_or_code_filter TEXT DEFAULT NULL,
  from_ts TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) - interval '7 days',
  to_ts TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  max_rows INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  incident_id TEXT,
  occurred_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ,
  severity TEXT,
  source TEXT,
  category TEXT,
  code TEXT,
  message TEXT,
  stack TEXT,
  fingerprint TEXT,
  app_version TEXT,
  release_channel TEXT,
  platform TEXT,
  os TEXT,
  route TEXT,
  session_id TEXT,
  user_id UUID,
  user_email TEXT,
  organization_id UUID,
  context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_action_filter TEXT;
  v_email_like TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(max_rows, 200), 1), 1000);
  v_action_filter := NULLIF(btrim(action_or_code_filter), '');
  v_email_like := CASE
    WHEN NULLIF(btrim(email_filter), '') IS NULL THEN NULL
    ELSE '%' || lower(btrim(email_filter)) || '%'
  END;

  RETURN QUERY
  SELECT
    e.id,
    e.incident_id,
    e.occurred_at,
    e.ingested_at,
    e.severity,
    e.source,
    e.category,
    e.code,
    e.message,
    e.stack,
    e.fingerprint,
    e.app_version,
    e.release_channel,
    e.platform,
    e.os,
    e.route,
    e.session_id,
    e.user_id,
    au.email::TEXT AS user_email,
    e.organization_id,
    e.context
  FROM public.app_incident_events e
  LEFT JOIN auth.users au ON au.id = e.user_id
  WHERE
    (incident_id_filter IS NULL OR e.incident_id = incident_id_filter)
    AND (user_id_filter IS NULL OR e.user_id = user_id_filter)
    AND (v_email_like IS NULL OR lower(COALESCE(au.email, '')) LIKE v_email_like)
    AND (
      v_action_filter IS NULL
      OR e.code ILIKE '%' || v_action_filter || '%'
      OR COALESCE(e.context->>'action', '') ILIKE '%' || v_action_filter || '%'
      OR e.message ILIKE '%' || v_action_filter || '%'
    )
    AND e.occurred_at >= COALESCE(from_ts, timezone('utc'::text, now()) - interval '7 days')
    AND e.occurred_at <= COALESCE(to_ts, timezone('utc'::text, now()))
  ORDER BY e.occurred_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_incident(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_app_incident(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_app_incidents_admin(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_incidents_admin(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

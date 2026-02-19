-- Migration: app_incident_events
-- Date: 2026-02-19
-- Description: Centralized incident logging for production support (PII-safe)

CREATE TABLE IF NOT EXISTS public.app_incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warn', 'info')),
  source TEXT NOT NULL CHECK (source IN ('renderer', 'desktop-main', 'supabase-client', 'react-query')),
  category TEXT NOT NULL CHECK (category IN ('auth', 'network', 'ui', 'runtime', 'storage')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  fingerprint TEXT NOT NULL,
  app_version TEXT NOT NULL,
  release_channel TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('desktop', 'web')),
  os TEXT NOT NULL,
  route TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_incidents_incident_id
  ON public.app_incident_events (incident_id);

CREATE INDEX IF NOT EXISTS idx_app_incidents_occurred_at_desc
  ON public.app_incident_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_incidents_user_occurred_desc
  ON public.app_incident_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_incidents_fingerprint_occurred_desc
  ON public.app_incident_events (fingerprint, occurred_at DESC);

ALTER TABLE public.app_incident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_incidents_admin_select" ON public.app_incident_events;
CREATE POLICY "app_incidents_admin_select"
  ON public.app_incident_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.app_incident_events FROM authenticated;
GRANT SELECT ON public.app_incident_events TO authenticated;
GRANT ALL ON public.app_incident_events TO service_role;

CREATE OR REPLACE FUNCTION public.sanitize_incident_text(input_text TEXT, max_len INTEGER DEFAULT 2000)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text TEXT;
  v_limit INTEGER;
BEGIN
  v_text := COALESCE(input_text, '');
  v_limit := LEAST(GREATEST(COALESCE(max_len, 2000), 1), 12000);

  -- redact likely email addresses
  v_text := regexp_replace(
    v_text,
    '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}',
    '[redacted-email]',
    'gi'
  );

  -- redact bearer tokens and JWT-like tokens
  v_text := regexp_replace(v_text, 'Bearer\s+[A-Za-z0-9._\-+/=]+', 'Bearer [redacted-token]', 'gi');
  v_text := regexp_replace(v_text, '\m[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\M', '[redacted-jwt]', 'g');

  -- redact common token-like key/value pairs
  v_text := regexp_replace(v_text, '(authorization\s*[:=]\s*)([^\s,}]+)', '\1[redacted-token]', 'gi');
  v_text := regexp_replace(v_text, '(apikey\s*[:=]\s*)([^\s,}]+)', '\1[redacted-token]', 'gi');
  v_text := regexp_replace(v_text, '(refresh_token\s*[:=]\s*)([^\s,}]+)', '\1[redacted-token]', 'gi');

  IF char_length(v_text) > v_limit THEN
    v_text := left(v_text, v_limit) || '…';
  END IF;

  RETURN v_text;
END;
$$;

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
      'http_status', NULLIF(input#>>'{context,http_status}', ''),
      'retry_count', NULLIF(input#>>'{context,retry_count}', ''),
      'provider', public.sanitize_incident_text(input#>>'{context,provider}', 128),
      'reason', public.sanitize_incident_text(input#>>'{context,reason}', 512),
      'release_channel', public.sanitize_incident_text(input#>>'{context,release_channel}', 64),
      'platform', public.sanitize_incident_text(input#>>'{context,platform}', 64),
      'os', public.sanitize_incident_text(input#>>'{context,os}', 64),
      'user_id', public.sanitize_incident_text(input#>>'{context,user_id}', 64),
      'organization_id', public.sanitize_incident_text(input#>>'{context,organization_id}', 64)
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

CREATE OR REPLACE FUNCTION public.purge_old_app_incident_events(days_to_keep INTEGER DEFAULT 60)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
  v_days INTEGER;
BEGIN
  v_days := LEAST(GREATEST(COALESCE(days_to_keep, 60), 7), 365);

  DELETE FROM public.app_incident_events
  WHERE ingested_at < timezone('utc'::text, now()) - make_interval(days => v_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_incidents_admin(
  incident_id_filter TEXT DEFAULT NULL,
  user_id_filter UUID DEFAULT NULL,
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(max_rows, 200), 1), 1000);

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
    e.organization_id,
    e.context
  FROM public.app_incident_events e
  WHERE
    (incident_id_filter IS NULL OR e.incident_id = incident_id_filter)
    AND (user_id_filter IS NULL OR e.user_id = user_id_filter)
    AND e.occurred_at >= COALESCE(from_ts, timezone('utc'::text, now()) - interval '7 days')
    AND e.occurred_at <= COALESCE(to_ts, timezone('utc'::text, now()))
  ORDER BY e.occurred_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_incident(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_incidents_admin(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_app_incident_events(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_app_incident(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_app_incidents_admin(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;

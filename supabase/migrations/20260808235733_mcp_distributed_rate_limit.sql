-- Distributed, fixed-window MCP rate limiting shared by every server instance.
-- The caller can choose only a risk bucket; limits and the 60-second window are
-- authoritative in this function. Direct table access stays closed.

CREATE TABLE public.mcp_rate_limit_buckets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 200),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id, risk_level, window_started_at)
);

CREATE INDEX idx_mcp_rate_limit_buckets_expires
  ON public.mcp_rate_limit_buckets(expires_at);

ALTER TABLE public.mcp_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_rate_limit_buckets
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_mcp_rate_limit(
  p_client_id TEXT,
  p_risk_level TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token_client_id TEXT := NULLIF(BTRIM(COALESCE(
    auth.jwt() ->> 'client_id',
    auth.jwt() ->> 'azp'
  )), '');
  v_client_id TEXT := NULLIF(BTRIM(p_client_id), '');
  v_risk_level TEXT := LOWER(NULLIF(BTRIM(p_risk_level), ''));
  v_limit INTEGER;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_started_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_request_count INTEGER;
  v_retry_after_seconds INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF v_client_id IS NULL OR char_length(v_client_id) > 200 THEN
    RAISE EXCEPTION 'Invalid MCP client identifier.' USING ERRCODE = '22023';
  END IF;

  IF v_token_client_id IS NULL THEN
    IF v_client_id <> 'local-stdio' THEN
      RAISE EXCEPTION 'MCP client does not match the authenticated session.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_client_id <> v_token_client_id THEN
    RAISE EXCEPTION 'MCP client does not match the authenticated token.'
      USING ERRCODE = '42501';
  END IF;

  v_limit := CASE v_risk_level
    WHEN 'low' THEN 120
    WHEN 'medium' THEN 30
    WHEN 'high' THEN 12
    ELSE NULL
  END;
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Invalid MCP risk level.' USING ERRCODE = '22023';
  END IF;

  v_window_started_at := TO_TIMESTAMP(
    FLOOR(EXTRACT(EPOCH FROM v_now) / 60) * 60
  );
  v_expires_at := v_window_started_at + INTERVAL '60 seconds';

  DELETE FROM public.mcp_rate_limit_buckets
  WHERE user_id = v_user_id
    AND expires_at <= v_now;

  INSERT INTO public.mcp_rate_limit_buckets(
    user_id,
    client_id,
    risk_level,
    window_started_at,
    request_count,
    expires_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_client_id,
    v_risk_level,
    v_window_started_at,
    1,
    v_expires_at,
    v_now
  )
  ON CONFLICT (user_id, client_id, risk_level, window_started_at)
  DO UPDATE SET
    request_count = public.mcp_rate_limit_buckets.request_count + 1,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at
  RETURNING request_count INTO v_request_count;

  v_retry_after_seconds := CASE
    WHEN v_request_count <= v_limit THEN 0
    ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::INTEGER)
  END;

  RETURN JSONB_BUILD_OBJECT(
    'allowed', v_request_count <= v_limit,
    'limit', v_limit,
    'remaining', GREATEST(v_limit - v_request_count, 0),
    'retry_after_seconds', v_retry_after_seconds,
    'reset_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_mcp_rate_limit(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_mcp_rate_limit(TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.mcp_rate_limit_buckets IS
  'Short-lived distributed MCP rate-limit counters; direct API access is denied.';
COMMENT ON FUNCTION public.consume_mcp_rate_limit(TEXT, TEXT) IS
  'Atomically consumes the authenticated user/client MCP risk bucket using fixed server-side limits.';

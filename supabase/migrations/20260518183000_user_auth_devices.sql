-- Sprava prihlasenych zarizeni pro uzivatele.
-- installation_id je pouze lokalni UX identifikator instalace/prohlizece,
-- nikoliv bezpecnostni atestace zarizeni.

CREATE TABLE IF NOT EXISTS public.user_auth_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  client_kind TEXT NOT NULL CHECK (client_kind IN ('desktop', 'mobile', 'web')),
  platform TEXT,
  user_agent TEXT,
  ip_address TEXT,
  auth_session_id UUID,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, installation_id)
);

ALTER TABLE public.user_auth_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_auth_devices_select_own" ON public.user_auth_devices;
DROP POLICY IF EXISTS "user_auth_devices_insert_own" ON public.user_auth_devices;
DROP POLICY IF EXISTS "user_auth_devices_update_own" ON public.user_auth_devices;
DROP POLICY IF EXISTS "user_auth_devices_delete_own" ON public.user_auth_devices;

CREATE POLICY "user_auth_devices_select_own"
  ON public.user_auth_devices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_auth_devices_insert_own"
  ON public.user_auth_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_auth_devices_update_own"
  ON public.user_auth_devices
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_auth_devices_delete_own"
  ON public.user_auth_devices
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.current_auth_session_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  raw_session_id TEXT;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  raw_session_id := NULLIF(claims ->> 'session_id', '');
  IF raw_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN raw_session_id::UUID;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_current_auth_device(
  p_installation_id TEXT,
  p_device_name TEXT,
  p_client_kind TEXT,
  p_platform TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session_id UUID := public.current_auth_session_id();
  v_session JSONB := NULL;
  v_device_id UUID;
  v_installation_id TEXT := NULLIF(TRIM(COALESCE(p_installation_id, '')), '');
  v_device_name TEXT := NULLIF(TRIM(COALESCE(p_device_name, '')), '');
  v_client_kind TEXT := LOWER(TRIM(COALESCE(p_client_kind, '')));
  v_platform TEXT := NULLIF(LEFT(TRIM(COALESCE(p_platform, '')), 120), '');
  v_user_agent TEXT := NULLIF(LEFT(TRIM(COALESCE(p_user_agent, '')), 512), '');
  v_ip_address TEXT := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF v_installation_id IS NULL OR LENGTH(v_installation_id) > 128 THEN
    RAISE EXCEPTION 'INVALID_INSTALLATION_ID' USING ERRCODE = '22023';
  END IF;

  IF v_device_name IS NULL THEN
    v_device_name := 'Neznámé zařízení';
  END IF;
  v_device_name := LEFT(v_device_name, 120);

  IF v_client_kind NOT IN ('desktop', 'mobile', 'web') THEN
    v_client_kind := 'web';
  END IF;

  IF v_session_id IS NOT NULL THEN
    SELECT to_jsonb(s)
      INTO v_session
      FROM auth.sessions s
      WHERE s.id = v_session_id
        AND s.user_id = v_user_id
      LIMIT 1;

    IF v_session IS NULL THEN
      v_session_id := NULL;
    END IF;
  END IF;

  v_user_agent := COALESCE(v_user_agent, NULLIF(LEFT(v_session ->> 'user_agent', 512), ''));
  v_ip_address := NULLIF(LEFT(COALESCE(v_session ->> 'ip', v_session ->> 'ip_address', ''), 80), '');

  INSERT INTO public.user_auth_devices (
    user_id,
    installation_id,
    device_name,
    client_kind,
    platform,
    user_agent,
    ip_address,
    auth_session_id,
    first_seen_at,
    last_seen_at,
    revoked_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_installation_id,
    v_device_name,
    v_client_kind,
    v_platform,
    v_user_agent,
    v_ip_address,
    v_session_id,
    NOW(),
    NOW(),
    NULL,
    NOW()
  )
  ON CONFLICT (user_id, installation_id)
  DO UPDATE SET
    device_name = EXCLUDED.device_name,
    client_kind = EXCLUDED.client_kind,
    platform = EXCLUDED.platform,
    user_agent = COALESCE(EXCLUDED.user_agent, public.user_auth_devices.user_agent),
    ip_address = COALESCE(EXCLUDED.ip_address, public.user_auth_devices.ip_address),
    auth_session_id = EXCLUDED.auth_session_id,
    last_seen_at = NOW(),
    revoked_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_device_id;

  RETURN v_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_auth_devices()
RETURNS TABLE (
  id UUID,
  installation_id TEXT,
  device_name TEXT,
  client_kind TEXT,
  platform TEXT,
  user_agent TEXT,
  ip_address TEXT,
  auth_session_id UUID,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.installation_id,
    d.device_name,
    d.client_kind,
    d.platform,
    d.user_agent,
    d.ip_address,
    d.auth_session_id,
    d.first_seen_at,
    d.last_seen_at,
    d.revoked_at,
    CASE
      WHEN d.revoked_at IS NOT NULL THEN 'revoked'
      WHEN d.auth_session_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM auth.sessions s
        WHERE s.id = d.auth_session_id
          AND s.user_id = v_user_id
      ) THEN 'active'
      ELSE 'revoked'
    END AS status
  FROM public.user_auth_devices d
  WHERE d.user_id = v_user_id
  ORDER BY d.last_seen_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_auth_device(p_device_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_device public.user_auth_devices%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT *
    INTO v_device
    FROM public.user_auth_devices
    WHERE id = p_device_id
      AND user_id = v_user_id
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND' USING ERRCODE = '02000';
  END IF;

  UPDATE public.user_auth_devices
  SET revoked_at = NOW(),
      updated_at = NOW()
  WHERE id = v_device.id
    AND user_id = v_user_id;

  IF v_device.auth_session_id IS NOT NULL THEN
    DELETE FROM auth.sessions s
    WHERE s.id = v_device.auth_session_id
      AND s.user_id = v_user_id;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_current_auth_device(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_auth_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_auth_device(UUID) TO authenticated;

-- Admin-facing purge RPC for incident logs.
-- Keeps existing scheduled retention flow intact while allowing manual cleanup from UI.

CREATE OR REPLACE FUNCTION public.purge_old_app_incident_events_admin(days_to_keep INTEGER DEFAULT 60)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_days := LEAST(GREATEST(COALESCE(days_to_keep, 60), 7), 365);

  RETURN public.purge_old_app_incident_events(v_days);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_app_incident_events_admin(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_app_incident_events_admin(INTEGER) TO service_role;

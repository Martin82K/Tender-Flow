-- Migration: dismiss_all_notifications
-- Date: 2026-04-21
-- Description: RPC function that dismisses all active notifications for the current user in one call.

CREATE OR REPLACE FUNCTION public.dismiss_all_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.notifications
  SET dismissed_at = NOW()
  WHERE user_id = auth.uid()
    AND dismissed_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_all_notifications() TO authenticated;

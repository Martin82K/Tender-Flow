-- Migration: fix_notification_cleanup_scope
-- Date: 2026-02-05
-- Description: Prevent cross-user notification cleanup by scoping deletes to the current user

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = auth.uid()
    AND created_at < NOW() - INTERVAL '5 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM authenticated;

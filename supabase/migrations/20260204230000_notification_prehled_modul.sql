-- Migration: notification_prehled_modul
-- Date: 2026-02-04
-- Description: Adds notification about new "Přehledy" module + auto-cleanup of old notifications

-- 1) Auto-delete notifications older than 5 days (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '5 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO authenticated;

-- 2) Update get_my_notifications to also cleanup old ones
CREATE OR REPLACE FUNCTION public.get_my_notifications(limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cleanup old notifications first
  PERFORM public.cleanup_old_notifications();
  
  RETURN QUERY
  SELECT n.id, n.type, n.title, n.body, n.created_at, n.read_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT limit_count;
END;
$$;

-- 3) Insert notification for all existing users about the new "Přehledy" module
INSERT INTO public.notifications (user_id, type, title, body)
SELECT 
  id AS user_id,
  'info' AS type,
  '🎉 Nový modul: Přehledy' AS title,
  'Byl přidán nový modul "Přehledy" pro zobrazení statistik a přehledů vašich zakázek.' AS body
FROM auth.users;

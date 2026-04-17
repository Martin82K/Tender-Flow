-- Migration: notification_system_v2
-- Date: 2026-04-03
-- Description: Extended notification system with categories, action URLs, preferences, individual read/dismiss

-- ============================================================
-- 1) Extend notifications table
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id);

-- ============================================================
-- 2) Notification preferences table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_status_changes BOOLEAN DEFAULT true,
  tender_closed BOOLEAN DEFAULT true,
  deadline_reminders BOOLEAN DEFAULT true,
  project_status_changes BOOLEAN DEFAULT true,
  document_events BOOLEAN DEFAULT true,
  team_events BOOLEAN DEFAULT true,
  agent_events BOOLEAN DEFAULT true,
  system_updates BOOLEAN DEFAULT true,
  desktop_notifications BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_upsert"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_update"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- 3) Updated get_my_notifications with category filter + dismiss exclusion
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_notifications(
  limit_count INT DEFAULT 20,
  category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  category TEXT,
  action_url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  dismissed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cleanup old notifications (14 days retention)
  DELETE FROM public.notifications
  WHERE public.notifications.created_at < NOW() - INTERVAL '14 days';

  RETURN QUERY
  SELECT
    n.id, n.type, n.title, n.body, n.created_at, n.read_at,
    n.category, n.action_url, n.entity_type, n.entity_id, n.dismissed_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND n.dismissed_at IS NULL
    AND (category_filter IS NULL OR n.category = category_filter)
  ORDER BY n.created_at DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_notifications(INT, TEXT) TO authenticated;

-- ============================================================
-- 4) Mark single notification as read
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE id = notification_id_input
    AND user_id = auth.uid()
    AND read_at IS NULL;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

-- ============================================================
-- 5) Dismiss single notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.dismiss_notification(notification_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET dismissed_at = NOW()
  WHERE id = notification_id_input
    AND user_id = auth.uid()
    AND dismissed_at IS NULL;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_notification(UUID) TO authenticated;

-- ============================================================
-- 6) Get notification preferences
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notification_preferences()
RETURNS TABLE (
  bid_status_changes BOOLEAN,
  tender_closed BOOLEAN,
  deadline_reminders BOOLEAN,
  project_status_changes BOOLEAN,
  document_events BOOLEAN,
  team_events BOOLEAN,
  agent_events BOOLEAN,
  system_updates BOOLEAN,
  desktop_notifications BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.bid_status_changes,
    np.tender_closed,
    np.deadline_reminders,
    np.project_status_changes,
    np.document_events,
    np.team_events,
    np.agent_events,
    np.system_updates,
    np.desktop_notifications,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM public.notification_preferences np
  WHERE np.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notification_preferences() TO authenticated;

-- ============================================================
-- 7) Save notification preferences (upsert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_notification_preferences(prefs JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (
    user_id,
    bid_status_changes,
    tender_closed,
    deadline_reminders,
    project_status_changes,
    document_events,
    team_events,
    agent_events,
    system_updates,
    desktop_notifications,
    quiet_hours_start,
    quiet_hours_end,
    updated_at
  )
  VALUES (
    auth.uid(),
    COALESCE((prefs->>'bid_status_changes')::BOOLEAN, true),
    COALESCE((prefs->>'tender_closed')::BOOLEAN, true),
    COALESCE((prefs->>'deadline_reminders')::BOOLEAN, true),
    COALESCE((prefs->>'project_status_changes')::BOOLEAN, true),
    COALESCE((prefs->>'document_events')::BOOLEAN, true),
    COALESCE((prefs->>'team_events')::BOOLEAN, true),
    COALESCE((prefs->>'agent_events')::BOOLEAN, true),
    COALESCE((prefs->>'system_updates')::BOOLEAN, true),
    COALESCE((prefs->>'desktop_notifications')::BOOLEAN, true),
    (prefs->>'quiet_hours_start')::TIME,
    (prefs->>'quiet_hours_end')::TIME,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    bid_status_changes = COALESCE((prefs->>'bid_status_changes')::BOOLEAN, notification_preferences.bid_status_changes),
    tender_closed = COALESCE((prefs->>'tender_closed')::BOOLEAN, notification_preferences.tender_closed),
    deadline_reminders = COALESCE((prefs->>'deadline_reminders')::BOOLEAN, notification_preferences.deadline_reminders),
    project_status_changes = COALESCE((prefs->>'project_status_changes')::BOOLEAN, notification_preferences.project_status_changes),
    document_events = COALESCE((prefs->>'document_events')::BOOLEAN, notification_preferences.document_events),
    team_events = COALESCE((prefs->>'team_events')::BOOLEAN, notification_preferences.team_events),
    agent_events = COALESCE((prefs->>'agent_events')::BOOLEAN, notification_preferences.agent_events),
    system_updates = COALESCE((prefs->>'system_updates')::BOOLEAN, notification_preferences.system_updates),
    desktop_notifications = COALESCE((prefs->>'desktop_notifications')::BOOLEAN, notification_preferences.desktop_notifications),
    quiet_hours_start = (prefs->>'quiet_hours_start')::TIME,
    quiet_hours_end = (prefs->>'quiet_hours_end')::TIME,
    updated_at = NOW();
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_notification_preferences(JSONB) TO authenticated;

-- ============================================================
-- 8) Insert notification (server-side helper for emitter)
--    Allows service_role or authenticated to insert with full fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_notification(
  target_user_id UUID,
  notif_type TEXT,
  notif_category TEXT,
  notif_title TEXT,
  notif_body TEXT DEFAULT NULL,
  notif_action_url TEXT DEFAULT NULL,
  notif_entity_type TEXT DEFAULT NULL,
  notif_entity_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, type, category, title, body, action_url, entity_type, entity_id
  )
  VALUES (
    target_user_id, notif_type, notif_category, notif_title, notif_body,
    notif_action_url, notif_entity_type, notif_entity_id
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 9) Update cleanup to 14 days
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;

-- ============================================================
-- 10) Enable Realtime on notifications table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- 11) Seed: system update notification about the new notification system
-- ============================================================
INSERT INTO public.notifications (user_id, type, category, title, body, action_url, entity_type, entity_id)
SELECT
  id AS user_id,
  'info' AS type,
  'system' AS category,
  'Novinka v1.5: Notifikační systém' AS title,
  'Nově vás aplikace upozorní na změny nabídek, blížící se termíny a uzavření výběrových řízení. Nastavení notifikací najdete v Nastavení → Notifikace.' AS body,
  '/app/settings?tab=user&subTab=notifications' AS action_url,
  'system_update' AS entity_type,
  'v1.5.0' AS entity_id
FROM auth.users;

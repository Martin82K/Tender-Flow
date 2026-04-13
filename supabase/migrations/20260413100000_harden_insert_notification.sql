-- Harden insert_notification against cross-user spoofing from authenticated clients.
-- service_role may still insert notifications for arbitrary users.

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
  IF auth.role() = 'authenticated' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication context is required'
      USING ERRCODE = '42501';
  END IF;

  IF auth.role() = 'authenticated' AND target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to insert notifications for other users'
      USING ERRCODE = '42501';
  END IF;

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

-- Migration: notifications
-- Date: 2026-02-04
-- Description: Simple notifications + org approval notification

-- 1) Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2) RPC helpers
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
  RETURN QUERY
  SELECT n.id, n.type, n.title, n.body, n.created_at, n.read_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_notifications(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;

-- 3) Add notification to org approval
CREATE OR REPLACE FUNCTION public.approve_org_join_request(request_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  target_user UUID;
  org_name TEXT;
BEGIN
  SELECT r.organization_id, r.user_id, o.name
  INTO org_id, target_user, org_name
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF NOT public.is_org_admin(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'approved', decided_at = NOW(), decided_by = auth.uid()
  WHERE id = request_id_input;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, target_user, 'member')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (target_user, 'success', 'Schválení v organizaci', 'Byli jste schváleni v organizaci ' || org_name || '.');

  RETURN TRUE;
END;
$$;

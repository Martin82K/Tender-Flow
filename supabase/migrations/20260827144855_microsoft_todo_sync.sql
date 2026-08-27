-- Microsoft To Do bidirectional synchronization state.
-- Tokens and synchronization cursors remain service-role-only; users continue
-- to access their task data through the existing ownership RLS policies.

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_access_kind_check;
ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read', 'todo_sync'));

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_project_scope_check;
ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_project_scope_check
  CHECK (access_kind IN ('personal_read', 'todo_sync') OR project_id IS NOT NULL);

ALTER TABLE public.dochub_user_tokens
  DROP CONSTRAINT IF EXISTS dochub_user_tokens_access_kind_check;
ALTER TABLE public.dochub_user_tokens
  ADD CONSTRAINT dochub_user_tokens_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read', 'todo_sync'));

COMMENT ON COLUMN public.dochub_oauth_states.project_id IS
  'Required for project grants; nullable for user-global personal_read and todo_sync Microsoft grants.';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS external_container_id TEXT,
  ADD COLUMN IF NOT EXISTS external_parent_id TEXT,
  ADD COLUMN IF NOT EXISTS external_etag TEXT,
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.idx_tasks_external;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external
  ON public.tasks(created_by, external_provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.microsoft_todo_list_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_project_id UUID REFERENCES public.task_projects(id) ON DELETE CASCADE,
  microsoft_list_id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  delta_link TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, microsoft_list_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_microsoft_todo_project_mapping
  ON public.microsoft_todo_list_mappings(user_id, todo_project_id)
  WHERE todo_project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_microsoft_todo_inbox_mapping
  ON public.microsoft_todo_list_mappings(user_id)
  WHERE todo_project_id IS NULL;

CREATE TABLE IF NOT EXISTS public.microsoft_todo_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  microsoft_list_id TEXT NOT NULL,
  microsoft_task_id TEXT NOT NULL,
  microsoft_parent_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, microsoft_list_id, microsoft_task_id)
);

CREATE TABLE IF NOT EXISTS public.microsoft_todo_sync_locks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_until TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.microsoft_todo_list_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microsoft_todo_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microsoft_todo_sync_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.microsoft_todo_list_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.microsoft_todo_tombstones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.microsoft_todo_sync_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.microsoft_todo_list_mappings TO service_role;
GRANT ALL ON TABLE public.microsoft_todo_tombstones TO service_role;
GRANT ALL ON TABLE public.microsoft_todo_sync_locks TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.enqueue_microsoft_todo_tombstone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.external_provider = 'ms-todo'
     AND OLD.external_id IS NOT NULL
     AND OLD.external_container_id IS NOT NULL THEN
    INSERT INTO public.microsoft_todo_tombstones (
      user_id,
      microsoft_list_id,
      microsoft_task_id,
      microsoft_parent_task_id
    ) VALUES (
      OLD.created_by,
      OLD.external_container_id,
      OLD.external_id,
      OLD.external_parent_id
    )
    ON CONFLICT (user_id, microsoft_list_id, microsoft_task_id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.enqueue_microsoft_todo_tombstone()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS tr_tasks_enqueue_microsoft_todo_tombstone ON public.tasks;
CREATE TRIGGER tr_tasks_enqueue_microsoft_todo_tombstone
  AFTER DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION private.enqueue_microsoft_todo_tombstone();

CREATE OR REPLACE FUNCTION public.acquire_microsoft_todo_sync_lock(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  acquired BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.microsoft_todo_sync_locks (user_id, locked_until)
  VALUES (target_user_id, NOW() + INTERVAL '2 minutes')
  ON CONFLICT (user_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until
    WHERE public.microsoft_todo_sync_locks.locked_until < NOW()
  RETURNING TRUE INTO acquired;
  RETURN COALESCE(acquired, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_microsoft_todo_sync_lock(target_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  DELETE FROM public.microsoft_todo_sync_locks WHERE user_id = target_user_id;
$$;

REVOKE ALL ON FUNCTION public.acquire_microsoft_todo_sync_lock(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_microsoft_todo_sync_lock(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_microsoft_todo_sync_lock(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_microsoft_todo_sync_lock(UUID) TO service_role;

COMMENT ON TABLE public.microsoft_todo_list_mappings IS
  'Service-only mapping and delta cursor for Tender Flow owned Microsoft To Do lists.';
COMMENT ON TABLE public.microsoft_todo_tombstones IS
  'Service-only durable queue for propagating local task deletions to Microsoft To Do.';

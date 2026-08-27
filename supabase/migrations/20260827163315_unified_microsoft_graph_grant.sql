-- One tenant-controlled delegated Microsoft Graph grant can serve both
-- online documents and Microsoft To Do while legacy grants remain valid.

BEGIN;

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_access_kind_check;
ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read', 'todo_sync', 'microsoft_graph'));

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_project_scope_check;
ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_project_scope_check
  CHECK (access_kind IN ('personal_read', 'todo_sync', 'microsoft_graph') OR project_id IS NOT NULL);

ALTER TABLE public.dochub_user_tokens
  DROP CONSTRAINT IF EXISTS dochub_user_tokens_access_kind_check;
ALTER TABLE public.dochub_user_tokens
  ADD CONSTRAINT dochub_user_tokens_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read', 'todo_sync', 'microsoft_graph'));

REVOKE ALL ON TABLE public.dochub_oauth_states
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.dochub_user_tokens
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dochub_oauth_states TO service_role;
GRANT ALL ON TABLE public.dochub_user_tokens TO service_role;

COMMENT ON COLUMN public.dochub_user_tokens.access_kind IS
  'manage = project owner grant; personal_read and todo_sync = legacy delegated grants; microsoft_graph = tenant-controlled unified delegated Graph grant';

COMMENT ON COLUMN public.dochub_oauth_states.project_id IS
  'Required for project grants; nullable for user-global personal_read, todo_sync and microsoft_graph grants.';

COMMIT;

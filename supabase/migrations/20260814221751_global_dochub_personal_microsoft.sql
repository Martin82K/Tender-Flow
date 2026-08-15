BEGIN;

ALTER TABLE public.dochub_oauth_states
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_project_scope_check;

ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_project_scope_check
  CHECK (access_kind = 'personal_read' OR project_id IS NOT NULL);

COMMENT ON COLUMN public.dochub_oauth_states.project_id IS
  'Required for project management grants; nullable only for a user-global personal_read Microsoft grant.';

COMMIT;

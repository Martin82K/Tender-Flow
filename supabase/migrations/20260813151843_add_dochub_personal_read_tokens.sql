-- Keep read-only delegated Microsoft grants separate from owner management grants.
ALTER TABLE public.dochub_oauth_states
  ADD COLUMN IF NOT EXISTS access_kind TEXT NOT NULL DEFAULT 'manage';

ALTER TABLE public.dochub_oauth_states
  DROP CONSTRAINT IF EXISTS dochub_oauth_states_access_kind_check;
ALTER TABLE public.dochub_oauth_states
  ADD CONSTRAINT dochub_oauth_states_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read'));

ALTER TABLE public.dochub_user_tokens
  ADD COLUMN IF NOT EXISTS access_kind TEXT NOT NULL DEFAULT 'manage';

ALTER TABLE public.dochub_user_tokens
  DROP CONSTRAINT IF EXISTS dochub_user_tokens_access_kind_check;
ALTER TABLE public.dochub_user_tokens
  ADD CONSTRAINT dochub_user_tokens_access_kind_check
  CHECK (access_kind IN ('manage', 'personal_read'));

ALTER TABLE public.dochub_user_tokens
  DROP CONSTRAINT IF EXISTS dochub_user_tokens_pkey;
ALTER TABLE public.dochub_user_tokens
  ADD PRIMARY KEY (user_id, provider, access_kind);

COMMENT ON COLUMN public.dochub_user_tokens.access_kind IS
  'manage = owner write-capable grant; personal_read = shared-user delegated read-only Microsoft grant';

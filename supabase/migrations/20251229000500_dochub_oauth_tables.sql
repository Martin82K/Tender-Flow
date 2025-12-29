-- Migration: dochub_oauth_tables
-- Date: 2025-12-29
-- Description: Tables for DocHub OAuth state and encrypted token storage.

CREATE TABLE IF NOT EXISTS public.dochub_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('gdrive', 'onedrive')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('user', 'org')),
  return_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dochub_user_tokens (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gdrive', 'onedrive')),
  token_ciphertext TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}'::TEXT[],
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.dochub_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dochub_user_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose: only service_role should access these tables.


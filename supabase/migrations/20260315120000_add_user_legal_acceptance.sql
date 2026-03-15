-- Migration: add_user_legal_acceptance
-- Date: 2026-03-15
-- Description: Adds audit fields for terms/privacy acceptance and a secure
--              function for authenticated users to confirm current legal docs.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.accept_current_legal_documents(
  p_terms_version TEXT,
  p_privacy_version TEXT
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.user_profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_profiles (
    user_id,
    terms_version,
    terms_accepted_at,
    privacy_version,
    privacy_accepted_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_terms_version,
    NOW(),
    p_privacy_version,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    terms_version = EXCLUDED.terms_version,
    terms_accepted_at = EXCLUDED.terms_accepted_at,
    privacy_version = EXCLUDED.privacy_version,
    privacy_accepted_at = EXCLUDED.privacy_accepted_at,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents(TEXT, TEXT) TO authenticated;

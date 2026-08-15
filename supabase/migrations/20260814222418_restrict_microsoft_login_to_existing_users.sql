BEGIN;

CREATE OR REPLACE FUNCTION public.hook_restrict_microsoft_login_to_existing_users(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  provider_name TEXT := lower(coalesce(event->'user'->'app_metadata'->>'provider', ''));
  candidate_email TEXT := lower(trim(coalesce(event->'user'->>'email', '')));
  existing_user BOOLEAN := false;
BEGIN
  IF provider_name <> 'azure' THEN
    RETURN '{}'::JSONB;
  END IF;

  IF candidate_email <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM auth.users
      WHERE lower(email) = candidate_email
        AND deleted_at IS NULL
    ) INTO existing_user;
  END IF;

  IF existing_user THEN
    RETURN '{}'::JSONB;
  END IF;

  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Microsoft login is available only for an existing Tender Flow account.'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hook_restrict_microsoft_login_to_existing_users(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_restrict_microsoft_login_to_existing_users(JSONB)
  TO supabase_auth_admin;

COMMENT ON FUNCTION public.hook_restrict_microsoft_login_to_existing_users(JSONB) IS
  'Before User Created hook: blocks Azure OAuth from creating a brand-new Tender Flow account.';

COMMIT;

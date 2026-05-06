-- Migration: user_avatar_upload
-- Date: 2026-05-06
-- Description: Adds private self-service avatars for user account menu.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_path TEXT NULL;

-- Keep self-service updates limited to non-privileged profile fields.
CREATE OR REPLACE FUNCTION public.guard_user_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    allowed_self_service_columns TEXT[] := ARRAY[
        'user_id',
        'display_name',
        'signature_name',
        'signature_role',
        'signature_phone',
        'signature_phone_secondary',
        'signature_email',
        'signature_greeting',
        'avatar_path',
        'terms_version',
        'terms_accepted_at',
        'privacy_version',
        'privacy_accepted_at',
        'created_at',
        'updated_at'
    ];
BEGIN
    IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Users may only manage their own profile';
    END IF;

    IF NEW.avatar_path IS NOT NULL
       AND NEW.avatar_path !~ ('^users/' || auth.uid()::text || '/avatar\.(png|jpg|jpeg|webp)$') THEN
        RAISE EXCEPTION 'Invalid avatar path';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (to_jsonb(NEW) - allowed_self_service_columns) IS DISTINCT FROM (to_jsonb(OLD) - allowed_self_service_columns) THEN
            RAISE EXCEPTION 'Protected profile fields cannot be changed by the profile owner';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profiles_sensitive_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_sensitive_columns
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_user_profiles_sensitive_columns();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "user_avatars_select_own" ON storage.objects;
CREATE POLICY "user_avatars_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND split_part(name, '/', 3) ~ '^avatar\.(png|jpg|jpeg|webp)$'
);

DROP POLICY IF EXISTS "user_avatars_insert_own" ON storage.objects;
CREATE POLICY "user_avatars_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND split_part(name, '/', 3) ~ '^avatar\.(png|jpg|jpeg|webp)$'
);

DROP POLICY IF EXISTS "user_avatars_update_own" ON storage.objects;
CREATE POLICY "user_avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-avatars'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND split_part(name, '/', 3) ~ '^avatar\.(png|jpg|jpeg|webp)$'
);

DROP POLICY IF EXISTS "user_avatars_delete_own" ON storage.objects;
CREATE POLICY "user_avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
);

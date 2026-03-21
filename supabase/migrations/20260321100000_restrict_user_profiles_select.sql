-- Migration: restrict_user_profiles_select
-- Date: 2026-03-21
-- Description: Restricts user_profiles SELECT access to profile owners to protect signature contact data.

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

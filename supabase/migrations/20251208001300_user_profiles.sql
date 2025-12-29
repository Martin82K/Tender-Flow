-- Migration: user_profiles
-- Date: 2025-12-08
-- Description: Adds user_profiles table for storing display names and other profile data

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles (for displaying in share lists, etc.)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.user_profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.user_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- Create function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_profile()
RETURNS TABLE (
    user_id UUID,
    display_name VARCHAR(255),
    email VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    current_email VARCHAR(255);
BEGIN
    current_user_id := auth.uid();
    
    -- Get email from auth.users
    SELECT au.email INTO current_email FROM auth.users au WHERE au.id = current_user_id;
    
    -- Insert profile if doesn't exist
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (current_user_id, NULL)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Return profile with email
    RETURN QUERY
    SELECT 
        up.user_id,
        up.display_name,
        current_email::VARCHAR(255)
    FROM public.user_profiles up
    WHERE up.user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_profile TO authenticated;

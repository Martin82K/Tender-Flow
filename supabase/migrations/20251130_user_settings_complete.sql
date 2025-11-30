-- Comprehensive User Settings Migration
-- This script is idempotent and can be run multiple times safely

-- Step 1: Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{"darkMode": false, "primaryColor": "#607AFB", "backgroundColor": "#f5f6f8"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;

-- Step 4: Create a single comprehensive policy that allows all operations
CREATE POLICY "Users can manage own settings"
ON public.user_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 5: Grant necessary permissions
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

-- Step 6: Verify the setup with a comment
COMMENT ON TABLE public.user_settings IS 'Stores user preferences like dark mode, colors, etc. Each user has one row.';

-- Done! You can verify by running:
-- SELECT * FROM public.user_settings WHERE user_id = auth.uid();

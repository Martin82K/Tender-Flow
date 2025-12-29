-- Migration: App Settings for Registration Control
-- Creates a table to store application-wide settings

CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    allow_public_registration BOOLEAN DEFAULT false,
    allowed_domains TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.app_settings (id, allow_public_registration, allowed_domains)
VALUES ('default', false, '{}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to read/write settings
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings" ON public.app_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Allow anyone to read settings (needed for registration validation)
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
    FOR SELECT
    USING (true);

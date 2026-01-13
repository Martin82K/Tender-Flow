-- Migration: App Secrets for Secure Key Storage
-- Creates a table to store sensitive application-wide secrets like API keys

CREATE TABLE IF NOT EXISTS public.app_secrets (
    id TEXT PRIMARY KEY DEFAULT 'default',
    google_api_key TEXT,
    openrouter_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row
INSERT INTO public.app_secrets (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service Role can do ANYTHING (for backend functions)
DROP POLICY IF EXISTS "Service role full access" ON public.app_secrets;
CREATE POLICY "Service role full access" ON public.app_secrets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 2: Admins can MANAGE secrets
DROP POLICY IF EXISTS "Admins can manage app_secrets" ON public.app_secrets;
CREATE POLICY "Admins can manage app_secrets" ON public.app_secrets
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Policy 3: Ordinary users DENY ALL (Implicit by default, but good to be aware)
-- No policy for standard users means they cannot read/write.

-- Migration: Email Whitelist for Registration
-- Date: 2025-12-17
-- Description: Adds email whitelist table to control which specific emails can register per domain

-- 1. Create whitelisted_emails table
CREATE TABLE IF NOT EXISTS public.whitelisted_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    domain VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whitelisted_emails_email ON public.whitelisted_emails(email);
CREATE INDEX IF NOT EXISTS idx_whitelisted_emails_domain ON public.whitelisted_emails(domain);

-- 3. Enable RLS
ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Only admins/superadmins can manage, but the check function runs as DEFINER
DROP POLICY IF EXISTS "whitelisted_emails_select" ON public.whitelisted_emails;
CREATE POLICY "whitelisted_emails_select" ON public.whitelisted_emails 
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "whitelisted_emails_insert" ON public.whitelisted_emails;
CREATE POLICY "whitelisted_emails_insert" ON public.whitelisted_emails 
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "whitelisted_emails_update" ON public.whitelisted_emails;
CREATE POLICY "whitelisted_emails_update" ON public.whitelisted_emails 
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "whitelisted_emails_delete" ON public.whitelisted_emails;
CREATE POLICY "whitelisted_emails_delete" ON public.whitelisted_emails 
    FOR DELETE USING (public.is_admin());

-- 5. Grant permissions
GRANT ALL ON public.whitelisted_emails TO authenticated;
GRANT ALL ON public.whitelisted_emails TO service_role;

-- 6. Add column to app_settings to enable/disable email whitelist mode
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'app_settings' AND column_name = 'require_email_whitelist') THEN
        ALTER TABLE public.app_settings ADD COLUMN require_email_whitelist BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 7. RPC to check if email is whitelisted (called during registration, runs as DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.check_email_whitelist(email_input TEXT)
RETURNS TABLE (
    is_whitelisted BOOLEAN,
    display_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    email_lower TEXT;
BEGIN
    email_lower := LOWER(TRIM(email_input));
    
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM public.whitelisted_emails WHERE LOWER(email) = email_lower AND is_active = true),
        (SELECT we.display_name FROM public.whitelisted_emails we WHERE LOWER(we.email) = email_lower AND we.is_active = true LIMIT 1);
END;
$$;

-- 8. RPC to get all whitelisted emails (for admin UI)
CREATE OR REPLACE FUNCTION public.get_whitelisted_emails()
RETURNS TABLE (
    id UUID,
    email VARCHAR(255),
    domain VARCHAR(100),
    display_name VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        we.id,
        we.email,
        we.domain,
        we.display_name,
        we.notes,
        we.is_active,
        we.created_at
    FROM public.whitelisted_emails we
    ORDER BY we.domain, we.email;
END;
$$;

-- 9. RPC to add email to whitelist
CREATE OR REPLACE FUNCTION public.add_whitelisted_email(
    email_input TEXT,
    display_name_input TEXT DEFAULT NULL,
    notes_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    email_lower TEXT;
    domain_part TEXT;
    new_id UUID;
BEGIN
    -- Only admins can call this
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    email_lower := LOWER(TRIM(email_input));
    domain_part := SPLIT_PART(email_lower, '@', 2);
    
    IF domain_part = '' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;

    INSERT INTO public.whitelisted_emails (email, domain, display_name, notes, created_by)
    VALUES (email_lower, domain_part, display_name_input, notes_input, auth.uid())
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- 10. RPC to remove email from whitelist
CREATE OR REPLACE FUNCTION public.remove_whitelisted_email(email_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    DELETE FROM public.whitelisted_emails WHERE id = email_id;
    RETURN true;
END;
$$;

-- 11. RPC to toggle email active status
CREATE OR REPLACE FUNCTION public.toggle_whitelisted_email(email_id UUID, new_active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    UPDATE public.whitelisted_emails SET is_active = new_active WHERE id = email_id;
    RETURN true;
END;
$$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.check_email_whitelist TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_whitelist TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whitelisted_emails TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_whitelisted_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_whitelisted_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_whitelisted_email TO authenticated;

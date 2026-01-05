
-- Create short_urls table
CREATE TABLE IF NOT EXISTS public.short_urls (
    id text PRIMARY KEY,
    original_url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    clicks integer DEFAULT 0,
    title text,
    description text
);

-- Enable RLS
ALTER TABLE public.short_urls ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read short URLs (to redirect)
CREATE POLICY "Everyone can read short URLs" ON public.short_urls
    FOR SELECT
    USING (true);

-- Authenticated users can create short URLs
CREATE POLICY "Authenticated users can create short URLs" ON public.short_urls
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Users can delete their own short URLs
CREATE POLICY "Users can delete their own short URLs" ON public.short_urls
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Increment clicks (handled by function/trigger or manual update by service role, but for now we allow public update for clicks only? 
-- Better to use a function for incrementing clicks to avoid exposing direct update access.
-- For simplicity in this demo, we'll allow authenticated users to update their own, but for public redirection click tracking, we might need a stored procedure.
-- Let's stick effectively to a stored procedure approach for click tracking or skip it for MVP public access if we don't want to open UPDATE policy too wide.
-- We will create a secure function to increment clicks.

CREATE OR REPLACE FUNCTION increment_short_url_clicks(url_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.short_urls
  SET clicks = clicks + 1
  WHERE id = url_id;
END;
$$;

-- Grant execute on function to public/anon if we want to track anonymous clicks
GRANT EXECUTE ON FUNCTION increment_short_url_clicks(text) TO anon, authenticated, service_role;

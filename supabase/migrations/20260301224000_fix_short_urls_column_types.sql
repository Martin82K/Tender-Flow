-- Ensure URL shortener columns are not length-limited by legacy varchar definitions
ALTER TABLE public.short_urls
  ALTER COLUMN id TYPE TEXT USING id::text,
  ALTER COLUMN original_url TYPE TEXT USING original_url::text,
  ALTER COLUMN title TYPE TEXT USING title::text,
  ALTER COLUMN description TYPE TEXT USING description::text;

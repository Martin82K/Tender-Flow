ALTER TABLE public.app_secrets 
ADD COLUMN IF NOT EXISTS service_role_key TEXT,
ADD COLUMN IF NOT EXISTS edge_function_base_url TEXT;

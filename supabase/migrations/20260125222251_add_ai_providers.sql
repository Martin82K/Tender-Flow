ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ai_ocr_provider text DEFAULT 'mistral';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ai_extraction_provider text DEFAULT 'openrouter';

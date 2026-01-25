-- Add AI model configuration to app_settings
alter table public.app_settings 
add column if not exists ai_ocr_model text default 'mistralai/mistral-ocr',
add column if not exists ai_extraction_model text default 'anthropic/claude-sonnet-4';

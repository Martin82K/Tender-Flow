-- Migration: add_ai_subscription_modules
-- Date: 2026-03-10
-- Description: Adds explicit AI subscription modules for Viki and OCR so
-- admins can manage availability per subscription tier.

INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('ai_viki', 'Povolit Viki', 'Přístup k AI asistentce Viki a jejím analytickým funkcím.', 'AI moduly', 51),
  ('ai_ocr', 'Povolit OCR', 'OCR zpracování dokumentů a extrakce dat ze smluv.', 'AI moduly', 52)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'ai_viki', false),
  ('starter', 'ai_viki', false),
  ('pro', 'ai_viki', true),
  ('enterprise', 'ai_viki', true),
  ('admin', 'ai_viki', true),
  ('free', 'ai_ocr', false),
  ('starter', 'ai_ocr', false),
  ('pro', 'ai_ocr', true),
  ('enterprise', 'ai_ocr', true),
  ('admin', 'ai_ocr', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

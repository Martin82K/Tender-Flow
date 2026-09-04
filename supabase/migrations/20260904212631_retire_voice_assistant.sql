-- Retire assistant entitlements without deleting historical usage or documents.
-- Keep referenced feature rows as archive records to preserve foreign keys.
DELETE FROM public.user_feature_overrides
WHERE feature_key IN ('ai_viki', 'feature_voice_assistant');

DELETE FROM public.subscription_tier_features
WHERE feature_key IN ('ai_viki', 'feature_voice_assistant');

UPDATE public.subscription_features
SET name = 'Archivovaná funkce',
    description = 'Funkce byla vyřazena. Záznam slouží pouze k uchování historie využití.',
    category = 'Archiv',
    updated_at = now()
WHERE key IN ('ai_viki', 'feature_voice_assistant');

DELETE FROM public.subscription_features f
WHERE f.key IN ('ai_viki', 'feature_voice_assistant')
  AND NOT EXISTS (
    SELECT 1 FROM public.feature_usage_events e WHERE e.feature_key = f.key
  );

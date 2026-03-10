-- Remove deprecated AI Insights subscription feature from admin matrix.
-- Re-map historical usage events to ai_viki before cleanup to satisfy FK constraints
-- and preserve Viki analytics continuity.

UPDATE public.feature_usage_events
SET feature_key = 'ai_viki'
WHERE feature_key = 'ai_insights';

DELETE FROM public.subscription_tier_features
WHERE feature_key = 'ai_insights';

DELETE FROM public.subscription_features
WHERE key = 'ai_insights';

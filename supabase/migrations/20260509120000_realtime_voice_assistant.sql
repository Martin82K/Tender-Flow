-- Migration: realtime_voice_assistant
-- Description: Feature flag and telemetry event support for OpenAI Realtime voice sessions.

INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES (
  'feature_voice_assistant',
  'Viky - hlasová AI asistentka',
  'Desktop-first hlasová asistentka Viky přes OpenAI Realtime s read-only nástroji.',
  'AI moduly',
  53
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'feature_voice_assistant', false),
  ('starter', 'feature_voice_assistant', false),
  ('pro', 'feature_voice_assistant', false),
  ('enterprise', 'feature_voice_assistant', false),
  ('admin', 'feature_voice_assistant', true)
ON CONFLICT (tier, feature_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  updated_at = timezone('utc'::text, now());

ALTER TABLE public.ai_voice_usage_events
  DROP CONSTRAINT IF EXISTS ai_voice_usage_events_event_type_check;

ALTER TABLE public.ai_voice_usage_events
  ADD CONSTRAINT ai_voice_usage_events_event_type_check
  CHECK (event_type IN ('transcribe', 'speak', 'realtime_session', 'realtime_tool_call'));

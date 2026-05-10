-- Migration: viky_text_usage_events
-- Description: Add metadata-only usage event types for Viky text-mode model routing.

ALTER TABLE public.ai_voice_usage_events
  DROP CONSTRAINT IF EXISTS ai_voice_usage_events_event_type_check;

ALTER TABLE public.ai_voice_usage_events
  ADD CONSTRAINT ai_voice_usage_events_event_type_check
  CHECK (event_type IN (
    'transcribe',
    'speak',
    'realtime_session',
    'realtime_tool_call',
    'text_response',
    'text_tool_call'
  ));

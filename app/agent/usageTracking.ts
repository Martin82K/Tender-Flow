import { trackFeatureUsage } from "@/services/featureUsageService";

const FEATURE_KEY = "ai_insights";

export const trackVikiUsageEvent = async (
  eventKey:
    | "voice_record_started"
    | "voice_transcribed"
    | "voice_tts_played"
    | "model_switched"
    | "audience_switched"
    | "context_policy_applied"
    | "output_guard_triggered"
    | "manual_context_used"
    | "manual_citation_emitted"
    | "manual_no_match"
    | "tool_executed"
    | "policy_decision_recorded"
    | "trace_recorded",
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  await trackFeatureUsage(FEATURE_KEY, {
    source: "viki",
    event: eventKey,
    ...metadata,
  });
};

import type { ContractWithDetails, Project, ProjectDetails, Subcontractor, View } from "@/types";

export const REALTIME_VOICE_MODELS = ["gpt-realtime-2", "gpt-realtime"] as const;
export const DEFAULT_REALTIME_VOICE_MODEL = REALTIME_VOICE_MODELS[0];

export type RealtimeVoiceModel = (typeof REALTIME_VOICE_MODELS)[number];
export type VoiceAssistantTextModel = "gpt-5-mini";

export const isRealtimeVoiceModel = (value: unknown): value is RealtimeVoiceModel =>
  typeof value === "string" && (REALTIME_VOICE_MODELS as readonly string[]).includes(value);

export type RealtimeSessionResponse = {
  clientSecret: string;
  expiresAt: string;
  sessionId: string;
  model: RealtimeVoiceModel;
};

export type VoiceAssistantTextToolCall = {
  id: string;
  callId: string;
  name: string;
  arguments: string;
};

export type VoiceAssistantTextToolOutput = {
  callId: string;
  name: string;
  output: unknown;
};

export type VoiceAssistantTextResponse = {
  kind: "message" | "tool_calls";
  responseId: string;
  model: VoiceAssistantTextModel;
  text?: string;
  toolCalls?: VoiceAssistantTextToolCall[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
    };
  };
};

export type VoiceAssistantState =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "ready"
  | "listening"
  | "responding"
  | "error";

export type VoiceAssistantMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type VoiceAssistantLiveTranscript = {
  role: "user" | "assistant";
  content: string;
  isPending: boolean;
};

export type VoiceAssistantResponseMode = "voice" | "conversation";

export type VoiceAssistantSources = {
  projects: Project[];
  contacts: Subcontractor[];
  projectDetails: Record<string, ProjectDetails>;
  contractsByProject?: Record<string, ContractWithDetails[]>;
};

export type VoiceAssistantContextData = {
  currentProjectId: string | null;
  currentView: View;
  sources: VoiceAssistantSources;
};

export type VoiceAssistantToolName =
  | "list_projects"
  | "find_project"
  | "get_project_detail"
  | "list_project_tenders"
  | "get_tender_detail"
  | "get_tender_winner"
  | "list_tender_bids"
  | "list_project_winners"
  | "get_contact_detail"
  | "get_schedule"
  | "get_tender_plan"
  | "get_contract_summary"
  | "get_contract_detail"
  | "search_projects"
  | "get_project_summary"
  | "list_upcoming_deadlines"
  | "find_contacts"
  | "draft_followup_email";

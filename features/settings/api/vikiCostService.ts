import { dbAdapter } from "@/services/dbAdapter";

export interface VikiCostOverview {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  voiceTranscribeSeconds: number;
  voiceTtsChars: number;
}

export interface VikiCostDailyItem {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  voiceTranscribeSeconds: number;
  voiceTtsChars: number;
}

export interface VikiCostModelItem {
  model: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getVikiCostOverviewAdmin = async (
  organizationId: string,
  daysBack = 30,
): Promise<VikiCostOverview> => {
  const { data, error } = await dbAdapter.rpc("get_viki_cost_overview_admin", {
    target_organization_id: organizationId,
    days_back: daysBack,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      voiceTranscribeSeconds: 0,
      voiceTtsChars: 0,
    };
  }

  return {
    requests: toNumber((row as Record<string, unknown>).requests),
    inputTokens: toNumber((row as Record<string, unknown>).input_tokens),
    outputTokens: toNumber((row as Record<string, unknown>).output_tokens),
    totalTokens: toNumber((row as Record<string, unknown>).total_tokens),
    estimatedCostUsd: toNumber((row as Record<string, unknown>).estimated_cost_usd),
    voiceTranscribeSeconds: toNumber((row as Record<string, unknown>).voice_transcribe_seconds),
    voiceTtsChars: toNumber((row as Record<string, unknown>).voice_tts_chars),
  };
};

export const getVikiCostDailyAdmin = async (
  organizationId: string,
  daysBack = 30,
): Promise<VikiCostDailyItem[]> => {
  const { data, error } = await dbAdapter.rpc("get_viki_cost_daily_admin", {
    target_organization_id: organizationId,
    days_back: daysBack,
  });

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    day: String(row.day || ""),
    requests: toNumber(row.requests),
    inputTokens: toNumber(row.input_tokens),
    outputTokens: toNumber(row.output_tokens),
    totalTokens: toNumber(row.total_tokens),
    estimatedCostUsd: toNumber(row.estimated_cost_usd),
    voiceTranscribeSeconds: toNumber(row.voice_transcribe_seconds),
    voiceTtsChars: toNumber(row.voice_tts_chars),
  }));
};

export const getVikiCostModelsAdmin = async (
  organizationId: string,
  daysBack = 30,
): Promise<VikiCostModelItem[]> => {
  const { data, error } = await dbAdapter.rpc("get_viki_cost_models_admin", {
    target_organization_id: organizationId,
    days_back: daysBack,
  });

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    model: String(row.model || "unknown"),
    requests: toNumber(row.requests),
    totalTokens: toNumber(row.total_tokens),
    estimatedCostUsd: toNumber(row.estimated_cost_usd),
  }));
};

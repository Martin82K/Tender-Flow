import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveTtsVoice, TTS_VOICE_ENV_KEY } from "./ttsVoice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VoiceCostMode = "economy" | "balanced" | "premium";

type VoiceBudgetStatus = {
  userUsedSecondsToday: number;
  userLimitSecondsToday: number;
  organizationUsedSecondsToday: number;
  organizationLimitSecondsToday: number;
  userUsedTtsCharsToday: number;
  userLimitTtsCharsToday: number;
  organizationUsedTtsCharsToday: number;
  organizationLimitTtsCharsToday: number;
};

const LIMITS: Record<VoiceCostMode, {
  maxDurationSeconds: number;
  userDailySeconds: number;
  organizationDailySeconds: number;
  userDailyTtsChars: number;
  organizationDailyTtsChars: number;
}> = {
  economy: {
    maxDurationSeconds: 30,
    userDailySeconds: 600,
    organizationDailySeconds: 3600,
    userDailyTtsChars: 12000,
    organizationDailyTtsChars: 96000,
  },
  balanced: {
    maxDurationSeconds: 45,
    userDailySeconds: 1200,
    organizationDailySeconds: 7200,
    userDailyTtsChars: 24000,
    organizationDailyTtsChars: 180000,
  },
  premium: {
    maxDurationSeconds: 60,
    userDailySeconds: 2400,
    organizationDailySeconds: 14000,
    userDailyTtsChars: 48000,
    organizationDailyTtsChars: 360000,
  },
};

const toCostMode = (value: unknown): VoiceCostMode => {
  if (value === "balanced" || value === "premium") return value;
  return "economy";
};

const decodeBase64 = (input: string): Uint8Array => {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const killSwitch = Deno.env.get("AI_FEATURE_ENABLED") ?? "true";
  if (killSwitch === "false") {
    return jsonResponse(
      {
        error: "Service temporarily unavailable",
        message: "AI voice features are currently disabled.",
      },
      503,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey,
      Authorization: authHeader,
    },
  });

  if (!authRes.ok) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  const user = await authRes.json();
  const { data: tier, error: tierError } = await service.rpc("get_user_subscription_tier", {
    target_user_id: user.id,
  });

  if (tierError) {
    return jsonResponse({ error: "Failed to verify subscription" }, 500);
  }

  const allowedTiers = ["pro", "enterprise", "admin"];
  if (!allowedTiers.includes(tier)) {
    return jsonResponse(
      {
        error: "Subscription required",
        message: "Voice mode requires PRO or higher subscription.",
      },
      403,
    );
  }

  const { data: orgRow } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!orgRow?.organization_id) {
    return jsonResponse({ error: "Organization context not found" }, 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const url = new URL(req.url);
  const isTranscribe = url.pathname.endsWith("/transcribe");
  const isSpeak = url.pathname.endsWith("/speak");

  if (!isTranscribe && !isSpeak) {
    return jsonResponse({ error: "Unsupported endpoint" }, 404);
  }

  const costMode = toCostMode(body?.costMode);
  const limits = LIMITS[costMode];

  const fetchBudget = async (): Promise<VoiceBudgetStatus> => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [userRows, orgRows] = await Promise.all([
      service
        .from("ai_voice_usage_events")
        .select("event_type,duration_seconds,char_count")
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString()),
      service
        .from("ai_voice_usage_events")
        .select("event_type,duration_seconds,char_count")
        .eq("organization_id", orgRow.organization_id)
        .gte("created_at", todayStart.toISOString()),
    ]);

    const userUsedSecondsToday = (userRows.data || [])
      .filter((row: any) => row.event_type === "transcribe")
      .reduce((sum: number, row: any) => sum + Number(row.duration_seconds || 0), 0);

    const organizationUsedSecondsToday = (orgRows.data || [])
      .filter((row: any) => row.event_type === "transcribe")
      .reduce((sum: number, row: any) => sum + Number(row.duration_seconds || 0), 0);

    const userUsedTtsCharsToday = (userRows.data || [])
      .filter((row: any) => row.event_type === "speak")
      .reduce((sum: number, row: any) => sum + Number(row.char_count || 0), 0);

    const organizationUsedTtsCharsToday = (orgRows.data || [])
      .filter((row: any) => row.event_type === "speak")
      .reduce((sum: number, row: any) => sum + Number(row.char_count || 0), 0);

    return {
      userUsedSecondsToday,
      userLimitSecondsToday: limits.userDailySeconds,
      organizationUsedSecondsToday,
      organizationLimitSecondsToday: limits.organizationDailySeconds,
      userUsedTtsCharsToday,
      userLimitTtsCharsToday: limits.userDailyTtsChars,
      organizationUsedTtsCharsToday,
      organizationLimitTtsCharsToday: limits.organizationDailyTtsChars,
    };
  };

  const budgetBefore = await fetchBudget();

  if (isTranscribe) {
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "audio/webm";
    const durationSeconds = Number(body?.durationSeconds || 0);

    if (!audioBase64) return jsonResponse({ error: "Missing audioBase64" }, 400);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return jsonResponse({ error: "Invalid durationSeconds" }, 400);
    }
    if (durationSeconds > limits.maxDurationSeconds) {
      return jsonResponse(
        {
          error: `Voice message too long. Max ${limits.maxDurationSeconds}s in ${costMode} mode.`,
          budget: budgetBefore,
        },
        413,
      );
    }

    if (budgetBefore.userUsedSecondsToday + durationSeconds > limits.userDailySeconds) {
      return jsonResponse(
        {
          error: "Daily user voice budget exceeded.",
          budget: budgetBefore,
        },
        429,
      );
    }

    if (budgetBefore.organizationUsedSecondsToday + durationSeconds > limits.organizationDailySeconds) {
      return jsonResponse(
        {
          error: "Daily organization voice budget exceeded.",
          budget: budgetBefore,
        },
        429,
      );
    }

    const preferredProvider = body?.preferredProvider === "openai" ? "openai" : "mistral";
    const bytes = decodeBase64(audioBase64);
    const file = new Blob([bytes], { type: mimeType || "audio/webm" });

    const openAiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    const mistralKey = (Deno.env.get("MISTRAL_API_KEY") || "").trim();

    const callMistral = async (): Promise<string> => {
      if (!mistralKey) throw new Error("Mistral API key missing");

      const formData = new FormData();
      formData.append("model", "voxtral-mini-transcribe");
      formData.append("file", file, "voice.webm");

      const response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mistralKey}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Mistral transcription failed");
      return String(data?.text || "").trim();
    };

    const callOpenAi = async (): Promise<string> => {
      if (!openAiKey) throw new Error("OpenAI API key missing");

      const formData = new FormData();
      formData.append("model", "gpt-4o-mini-transcribe");
      formData.append("file", file, "voice.webm");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "OpenAI transcription failed");
      return String(data?.text || "").trim();
    };

    let text = "";
    let provider: "mistral" | "openai" = preferredProvider;
    try {
      text = preferredProvider === "mistral" ? await callMistral() : await callOpenAi();
    } catch {
      provider = preferredProvider === "mistral" ? "openai" : "mistral";
      text = provider === "mistral" ? await callMistral() : await callOpenAi();
    }

    if (!text) {
      return jsonResponse({ error: "Empty transcription result", budget: budgetBefore }, 502);
    }

    await service.from("ai_voice_usage_events").insert({
      organization_id: orgRow.organization_id,
      user_id: user.id,
      event_type: "transcribe",
      provider,
      duration_seconds: Math.round(durationSeconds),
      char_count: null,
      cost_mode: costMode,
      metadata: {
        mimeType,
      },
    });

    const budgetAfter = await fetchBudget();

    return jsonResponse({
      text,
      provider,
      budget: budgetAfter,
      warning:
        budgetAfter.userUsedSecondsToday > limits.userDailySeconds * 0.85
          ? "Blížíš se k dennímu limitu hlasového přepisu."
          : undefined,
    });
  }

  const text = String(body?.text || "").trim();
  if (!text) {
    return jsonResponse({ error: "Missing text" }, 400);
  }

  if (budgetBefore.userUsedTtsCharsToday + text.length > limits.userDailyTtsChars) {
    return jsonResponse(
      {
        error: "Daily user TTS budget exceeded.",
        budget: budgetBefore,
      },
      429,
    );
  }

  if (budgetBefore.organizationUsedTtsCharsToday + text.length > limits.organizationDailyTtsChars) {
    return jsonResponse(
      {
        error: "Daily organization TTS budget exceeded.",
        budget: budgetBefore,
      },
      429,
    );
  }

  const openAiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!openAiKey) {
    const budgetAfterFallback = await fetchBudget();
    return jsonResponse({
      provider: "browser",
      budget: budgetAfterFallback,
      warning: "Cloud TTS není nakonfigurováno, použijte browser speech fallback.",
    });
  }

  const requestedVoice = typeof body?.voice === "string" ? body.voice : "";
  const ttsVoice = resolveTtsVoice(requestedVoice, Deno.env.get(TTS_VOICE_ENV_KEY));

  const speakResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: ttsVoice,
      input: text,
      format: "mp3",
    }),
  });

  if (!speakResponse.ok) {
    const details = await speakResponse.text();
    return jsonResponse(
      {
        error: "Cloud TTS request failed",
        details,
        budget: budgetBefore,
      },
      502,
    );
  }

  const audioBuffer = await speakResponse.arrayBuffer();
  const audioBase64 = toBase64(audioBuffer);

  await service.from("ai_voice_usage_events").insert({
    organization_id: orgRow.organization_id,
    user_id: user.id,
    event_type: "speak",
    provider: "openai",
    duration_seconds: null,
    char_count: text.length,
    cost_mode: costMode,
    metadata: {
      voice: ttsVoice,
      model: "gpt-4o-mini-tts",
    },
  });

  const budgetAfter = await fetchBudget();

  return jsonResponse({
    provider: "openai",
    audioBase64,
    mimeType: "audio/mpeg",
    budget: budgetAfter,
    warning:
      budgetAfter.userUsedTtsCharsToday > limits.userDailyTtsChars * 0.85
        ? "Blížíš se k dennímu limitu hlasových odpovědí."
        : undefined,
  });
});

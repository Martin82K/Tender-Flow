import { beforeEach, describe, expect, it, vi } from "vitest";

describe("vikiCostService", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("nacte overview metriky pres RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          requests: 12,
          input_tokens: 1500,
          output_tokens: 900,
          total_tokens: 2400,
          estimated_cost_usd: 1.25,
          voice_transcribe_seconds: 180,
          voice_tts_chars: 560,
        },
      ],
      error: null,
    });

    vi.doMock("@/services/dbAdapter", () => ({
      dbAdapter: { rpc },
    }));

    const { getVikiCostOverviewAdmin } = await import("@/features/settings/api/vikiCostService");
    const overview = await getVikiCostOverviewAdmin("org-1", 30);

    expect(rpc).toHaveBeenCalledWith("get_viki_cost_overview_admin", {
      target_organization_id: "org-1",
      days_back: 30,
    });
    expect(overview.totalTokens).toBe(2400);
    expect(overview.estimatedCostUsd).toBe(1.25);
  });

  it("nacte model breakdown pres RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          model: "gpt-5-mini",
          requests: 10,
          total_tokens: 2000,
          estimated_cost_usd: 0.9,
        },
      ],
      error: null,
    });

    vi.doMock("@/services/dbAdapter", () => ({
      dbAdapter: { rpc },
    }));

    const { getVikiCostModelsAdmin } = await import("@/features/settings/api/vikiCostService");
    const rows = await getVikiCostModelsAdmin("org-1", 7);

    expect(rpc).toHaveBeenCalledWith("get_viki_cost_models_admin", {
      target_organization_id: "org-1",
      days_back: 7,
    });
    expect(rows[0].model).toBe("gpt-5-mini");
  });
});

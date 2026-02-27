import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeAuthedFunctionMock = vi.fn();

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: (...args: unknown[]) => invokeAuthedFunctionMock(...args),
}));

import { getProviderModels } from "@app/agent/modelCatalog";

describe("viki model catalog", () => {
  beforeEach(() => {
    invokeAuthedFunctionMock.mockReset();
  });

  it("vrací statický katalog pro google", async () => {
    const models = await getProviderModels("google");

    expect(models.length).toBeGreaterThan(0);
    expect(models.some((item) => item.id.includes("gemini"))).toBe(true);
    expect(invokeAuthedFunctionMock).not.toHaveBeenCalled();
  });

  it("normalizuje modely z ai-proxy", async () => {
    invokeAuthedFunctionMock.mockResolvedValue({
      models: [
        {
          id: "mistral-small-latest",
          label: "Mistral Small",
          provider: "mistral",
          capabilities: ["chat"],
          pricingHint: "Úsporný",
        },
      ],
    });

    const models = await getProviderModels("mistral");

    expect(invokeAuthedFunctionMock).toHaveBeenCalledTimes(1);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("mistral-small-latest");
  });

  it("fallbackne na default při selhání provider API", async () => {
    invokeAuthedFunctionMock.mockRejectedValue(new Error("network"));

    const models = await getProviderModels("openrouter");

    expect(models.length).toBeGreaterThan(0);
    expect(models.some((item) => item.id === "anthropic/claude-3.5-sonnet")).toBe(true);
  });
});

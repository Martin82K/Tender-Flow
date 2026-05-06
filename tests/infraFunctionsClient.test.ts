import { describe, expect, it, vi } from "vitest";

const functionsClientMock = vi.hoisted(() => ({
  invokeAuthedFunction: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

vi.mock("@/services/functionsClient", () => functionsClientMock);

import {
  invokeAuthedFunction,
  invokePublicFunction,
} from "@infra/functions/functionsClient";

describe("infra functions client", () => {
  it("deleguje autentizovana i verejna volani do legacy klienta", async () => {
    functionsClientMock.invokeAuthedFunction.mockResolvedValue({ ok: true });
    functionsClientMock.invokePublicFunction.mockResolvedValue({ public: true });

    await expect(
      invokeAuthedFunction("ai-proxy", { body: { prompt: "test" } }),
    ).resolves.toEqual({ ok: true });
    await expect(
      invokePublicFunction("legal-state", { method: "GET" }),
    ).resolves.toEqual({ public: true });

    expect(functionsClientMock.invokeAuthedFunction).toHaveBeenCalledWith(
      "ai-proxy",
      { body: { prompt: "test" } },
    );
    expect(functionsClientMock.invokePublicFunction).toHaveBeenCalledWith(
      "legal-state",
      { method: "GET" },
    );
  });
});

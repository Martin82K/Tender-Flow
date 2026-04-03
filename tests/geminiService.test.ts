import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  invokeAuthedFunction: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: mockState.invokeAuthedFunction,
}));

describe("geminiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockState.fetch);
  });

  it("při chybě loguje jen sanitizované shrnutí", async () => {
    mockState.invokeAuthedFunction.mockRejectedValue(
      new Error("token Bearer abc.def.ghi user john@example.com"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { getAiSuggestion } = await import("../services/geminiService");
    await expect(getAiSuggestion("test")).resolves.toBe("AI service temporarily unavailable.");

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).toContain("[redacted-email]");
    expect(serializedCalls).toContain("[redacted-token]");
    expect(serializedCalls).not.toContain("john@example.com");
    expect(serializedCalls).not.toContain("abc.def.ghi");

    errorSpy.mockRestore();
  });

  it("pri chybe ARES lookupu neloguje citlive hodnoty", async () => {
    mockState.fetch.mockRejectedValue(
      new Error("token Bearer abc.def.ghi user john@example.com"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(findCompanyRegions([{ id: "1", company: "Firma", ico: "123" }])).resolves.toEqual({});

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).not.toContain("john@example.com");
    expect(serializedCalls).not.toContain("abc.def.ghi");
    expect(serializedCalls).toContain("ARES registration lookup failed");
    expect(serializedCalls).toContain("[redacted-email]");
    expect(serializedCalls).toContain("[redacted-token]");

    errorSpy.mockRestore();
  });

  it("vraci region z ARES odpovedi", async () => {
    mockState.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        sidlo: {
          nazevKraje: "Hlavní město Praha",
        },
      }),
    });

    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(
      findCompanyRegions([
        { id: "1", company: "Firma A", ico: "123" },
        { id: "2", company: "Firma B", ico: "456" },
      ]),
    ).resolves.toEqual({
      "1": "Hlavní město Praha",
      "2": "Hlavní město Praha",
    });
  });

  it("pouzije fallback region z dalsichUdaju", async () => {
    mockState.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        dalsiUdaje: [
          {
            sidlo: [
              {
                sidlo: {
                  nazevKraje: "Jihomoravský kraj",
                },
                primarniZaznam: true,
              },
            ],
          },
        ],
      }),
    });

    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(
      findCompanyRegions([{ id: "1", company: "Firma A", ico: "12345678" }]),
    ).resolves.toEqual({ "1": "Jihomoravský kraj" });
  });

  it("posila do ARES ocistene ICO bez mezer a znaku", async () => {
    mockState.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        sidlo: {
          nazevKraje: "Praha",
        },
      }),
    });

    const { findCompanyRegions } = await import("../services/geminiService");
    await findCompanyRegions([{ id: "1", company: "Firma A", ico: "123 45 678" }]);

    expect(mockState.fetch).toHaveBeenCalledWith(
      "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/12345678",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("pri nevalidnim ICO lookup preskoci", async () => {
    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(
      findCompanyRegions([{ id: "1", company: "Firma A", ico: "abc" }]),
    ).resolves.toEqual({});

    expect(mockState.fetch).not.toHaveBeenCalled();
  });

  it("pri 404 vraci prazdny vysledek bez chyby", async () => {
    mockState.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn(),
    });

    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(
      findCompanyRegions([{ id: "1", company: "Firma A", ico: "12345678" }]),
    ).resolves.toEqual({});

    expect(mockState.fetch).toHaveBeenCalledTimes(1);
  });

  it("doplni vedouci nuly do ICO", async () => {
    mockState.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        sidlo: {
          nazevKraje: "Praha",
        },
      }),
    });

    const { findCompanyRegions } = await import("../services/geminiService");
    await findCompanyRegions([{ id: "1", company: "Firma A", ico: "6947" }]);

    expect(mockState.fetch).toHaveBeenCalledWith(
      "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00006947",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("vraci vedle regionu i adresu sidla", async () => {
    mockState.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        sidlo: {
          nazevKraje: "Karlovarský kraj",
          textovaAdresa: "č.p. 88, 36225 Božičany",
        },
      }),
    });

    const { findCompanyRegistrationDetails } = await import("../services/geminiService");
    await expect(
      findCompanyRegistrationDetails([{ id: "1", company: "Firma A", ico: "64356221" }]),
    ).resolves.toEqual({
      "1": {
        region: "Karlovarský kraj",
        address: "č.p. 88, 36225 Božičany",
      },
    });
  });
});

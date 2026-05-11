import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getOriginalUrl: vi.fn(),
  normalizeSafeShortRedirectUrl: vi.fn((url: string) => url),
}));

vi.mock("@/services/urlShortenerService", () => ({
  getOriginalUrl: (code: string) => state.getOriginalUrl(code),
  normalizeSafeShortRedirectUrl: (url: string) => state.normalizeSafeShortRedirectUrl(url),
}));

import { ShortUrlRedirect } from "@/shared/routing/ShortUrlRedirect";

describe("ShortUrlRedirect", () => {
  beforeEach(() => {
    state.getOriginalUrl.mockReset();
    state.normalizeSafeShortRedirectUrl.mockReset();
    state.normalizeSafeShortRedirectUrl.mockImplementation((url: string) => url);
  });

  it("zobrazi interstitial s cilovou domenou pro externi redirect", async () => {
    state.getOriginalUrl.mockResolvedValue({
      url: "https://public.example.com/tender?id=123",
    });

    render(<ShortUrlRedirect code="abc123" />);

    expect(await screen.findByRole("heading", { name: "Pokračovat mimo Tender Flow" })).toBeInTheDocument();
    expect(screen.getByText("Cílová doména: public.example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pokračovat" })).toHaveAttribute(
      "href",
      "https://public.example.com/tender?id=123",
    );
  });

  it("zobrazi chybu, kdyz cilova URL neprojde bezpecnostni normalizaci", async () => {
    state.getOriginalUrl.mockResolvedValue({
      url: "https://localhost/admin",
    });
    state.normalizeSafeShortRedirectUrl.mockReturnValue(null);

    render(<ShortUrlRedirect code="abc123" />);

    expect(await screen.findByRole("heading", { name: "Chyba přesměrování" })).toBeInTheDocument();
    expect(screen.getByText("Odkaz je neplatný nebo blokovaný z bezpečnostních důvodů.")).toBeInTheDocument();
  });
});

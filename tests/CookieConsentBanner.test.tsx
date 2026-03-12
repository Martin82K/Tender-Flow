import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CookieConsentBanner } from "@/features/public/ui/CookieConsentBanner";
import {
  clearCookieConsentDecision,
  getCookieConsentDecision,
} from "@/shared/privacy/cookieConsent";

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCookieConsentDecision();
    window.history.replaceState({}, "", "/");
  });

  it("zobrazí banner bez uloženého souhlasu a uloží essential only", () => {
    render(<CookieConsentBanner />);

    expect(screen.getByText("Nastavení cookies")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jen nezbytné" }));

    expect(getCookieConsentDecision()).toBe("essential_only");
    expect(screen.queryByText("Nastavení cookies")).not.toBeInTheDocument();
  });

  it("po přijetí všeho už banner znovu nezobrazí", () => {
    render(<CookieConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Přijmout vše" }));
    expect(getCookieConsentDecision()).toBe("accepted_all");

    render(<CookieConsentBanner />);
    expect(screen.queryByText("Nastavení cookies")).not.toBeInTheDocument();
  });
});

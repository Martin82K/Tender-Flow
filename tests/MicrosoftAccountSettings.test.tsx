import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MicrosoftAccountSettings } from "@features/settings/MicrosoftAccountSettings";

const accountMocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  connectDocumentAccess: vi.fn(),
  disconnectDocumentAccess: vi.fn(),
  getLoginIdentity: vi.fn(),
  linkLoginIdentity: vi.fn(),
  unlinkLoginIdentity: vi.fn(),
}));

vi.mock("@/infra/auth/microsoftAccountService", () => ({
  microsoftAccountService: accountMocks,
}));

describe("MicrosoftAccountSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountMocks.getStatus.mockResolvedValue({ connected: false });
    accountMocks.getLoginIdentity.mockResolvedValue({
      available: true,
      linked: false,
      email: null,
    });
    accountMocks.connectDocumentAccess.mockResolvedValue(undefined);
    accountMocks.disconnectDocumentAccess.mockResolvedValue(undefined);
    accountMocks.linkLoginIdentity.mockResolvedValue(undefined);
    accountMocks.unlinkLoginIdentity.mockResolvedValue(undefined);
  });

  it("zobrazuje jedno propojení Microsoft účtu místo dvou samostatných karet", async () => {
    render(<MicrosoftAccountSettings />);

    expect(await screen.findByText("Microsoft účet")).toBeVisible();
    expect(screen.queryByText("Přihlášení do Tender Flow")).not.toBeInTheDocument();
    expect(screen.queryByText("OneDrive a SharePoint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Propojit Microsoft účet" })).toBeEnabled();
  });

  it("nejprve napáruje přihlášení a po návratu pokračuje oprávněním k dokumentům", async () => {
    render(<MicrosoftAccountSettings />);

    fireEvent.click(await screen.findByRole("button", { name: "Propojit Microsoft účet" }));
    await waitFor(() => expect(accountMocks.linkLoginIdentity).toHaveBeenCalledTimes(1));
    expect(accountMocks.connectDocumentAccess).not.toHaveBeenCalled();

    accountMocks.getLoginIdentity.mockResolvedValue({
      available: true,
      linked: true,
      email: "martin@example.com",
    });
    window.dispatchEvent(new Event("focus"));

    fireEvent.click(await screen.findByRole("button", { name: "Dokončit připojení dokumentů" }));
    await waitFor(() => expect(accountMocks.connectDocumentAccess).toHaveBeenCalledTimes(1));
    expect(accountMocks.getStatus).toHaveBeenCalledWith();
  });

  it("po úplném propojení schová odvolání oprávnění do detailu", async () => {
    accountMocks.getStatus.mockResolvedValue({ connected: true });
    accountMocks.getLoginIdentity.mockResolvedValue({
      available: true,
      linked: true,
      email: "martin@example.com",
    });

    render(<MicrosoftAccountSettings />);

    expect(await screen.findByText("martin@example.com")).toBeVisible();
    expect(screen.getByText("Microsoft účet je propojený")).toBeVisible();
    expect(screen.getByText("Spravovat propojení").closest("details")).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Spravovat propojení"));
    fireEvent.click(screen.getByRole("button", { name: "Odpojit dokumenty" }));
    await waitFor(() => expect(accountMocks.disconnectDocumentAccess).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Odebrat napárování" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Odebrat napárování" }));
    await waitFor(() => expect(accountMocks.unlinkLoginIdentity).toHaveBeenCalledTimes(1));
  });

  it("při postupném nasazení skryje chybu staré projektové funkce a zachová napárování", async () => {
    accountMocks.getStatus.mockRejectedValue(new Error("Missing projectId"));

    render(<MicrosoftAccountSettings />);

    expect(await screen.findByRole("button", { name: "Propojit Microsoft účet" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

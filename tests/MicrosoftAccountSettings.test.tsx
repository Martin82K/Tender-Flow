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
  getTodoStatus: vi.fn(),
  connectTodoAccess: vi.fn(),
  disconnectTodoAccess: vi.fn(),
  getGraphStatus: vi.fn(),
  connectMicrosoftAccount: vi.fn(),
  completeMicrosoftAccountConnection: vi.fn(),
  disconnectMicrosoftAccount: vi.fn(),
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
    accountMocks.getTodoStatus.mockResolvedValue({
      connected: false,
      lastSyncedAt: null,
      syncError: null,
    });
    accountMocks.connectTodoAccess.mockResolvedValue(undefined);
    accountMocks.disconnectTodoAccess.mockResolvedValue(undefined);
    accountMocks.getGraphStatus.mockResolvedValue({ connected: false });
    accountMocks.connectMicrosoftAccount.mockResolvedValue(undefined);
    accountMocks.completeMicrosoftAccountConnection.mockResolvedValue(false);
    accountMocks.disconnectMicrosoftAccount.mockResolvedValue(undefined);
  });

  it("zobrazuje jedno propojení Microsoft účtu místo dvou samostatných karet", async () => {
    render(<MicrosoftAccountSettings />);

    expect(await screen.findByText("Microsoft účet")).toBeVisible();
    expect(screen.queryByText("Přihlášení do Tender Flow")).not.toBeInTheDocument();
    expect(screen.queryByText("OneDrive a SharePoint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Propojit Microsoft účet" })).toBeEnabled();
  });

  it("spustí jedinou akci pro přihlášení, dokumenty i Microsoft To Do", async () => {
    render(<MicrosoftAccountSettings />);

    fireEvent.click(await screen.findByRole("button", { name: "Propojit Microsoft účet" }));
    await waitFor(() => expect(accountMocks.connectMicrosoftAccount).toHaveBeenCalledTimes(1));
    expect(accountMocks.linkLoginIdentity).not.toHaveBeenCalled();
    expect(accountMocks.connectDocumentAccess).not.toHaveBeenCalled();
    expect(accountMocks.connectTodoAccess).not.toHaveBeenCalled();
  });

  it("po úplném propojení schová odvolání oprávnění do detailu", async () => {
    accountMocks.getGraphStatus.mockResolvedValue({ connected: true });
    accountMocks.getStatus.mockResolvedValue({ connected: true });
    accountMocks.getTodoStatus.mockResolvedValue({
      connected: true,
      lastSyncedAt: "2026-08-27T12:00:00Z",
      syncError: null,
    });
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
    fireEvent.click(screen.getByRole("button", { name: "Odpojit Microsoft účet" }));
    await waitFor(() => expect(accountMocks.disconnectMicrosoftAccount).toHaveBeenCalledTimes(1));
    expect(accountMocks.disconnectDocumentAccess).not.toHaveBeenCalled();
    expect(accountMocks.disconnectTodoAccess).not.toHaveBeenCalled();
  });

  it("u dříve napárované identity nabídne jediné dokončení celého propojení", async () => {
    accountMocks.getLoginIdentity.mockResolvedValue({
      available: true,
      linked: true,
      email: "martin@example.com",
    });

    render(<MicrosoftAccountSettings />);

    fireEvent.click(await screen.findByRole("button", { name: "Dokončit propojení Microsoft účtu" }));
    await waitFor(() => expect(accountMocks.connectMicrosoftAccount).toHaveBeenCalledTimes(1));
    expect(accountMocks.connectTodoAccess).not.toHaveBeenCalled();
  });

  it("při chybě nové Graph funkce zobrazí uživateli srozumitelnou chybu", async () => {
    accountMocks.getGraphStatus.mockRejectedValue(new Error("Edge funkce není nasazená"));

    render(<MicrosoftAccountSettings />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Edge funkce není nasazená");
  });
});

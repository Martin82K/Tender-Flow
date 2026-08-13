import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocHubSetupWizard } from "@features/projects/documents/ui/dochub/DocHubSetupWizard";
import { DocHubStatusCard } from "@features/projects/documents/ui/dochub/DocHubStatusCard";

const actions = {
  pickLocalFolder: vi.fn(),
  openRoot: vi.fn(),
  resolveRoot: vi.fn(),
  createGoogleRoot: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  saveSetup: vi.fn(),
  connectPersonalMicrosoft: vi.fn(),
  disconnectPersonalMicrosoft: vi.fn(),
};

const setters = {
  setProvider: vi.fn(),
  setMode: vi.fn(),
  setRootLink: vi.fn(),
  setNewFolderName: vi.fn(),
  setIsEditingSetup: vi.fn(),
  setOnlineRootLinkDraft: vi.fn(),
};

const sharedState = {
  provider: "onedrive",
  mode: "user",
  rootName: "Projekt 1",
  rootLink: "D:\\Shared\\Projekt 1",
  onlineRootLink: "https://tenant.sharepoint.com/sites/project/shared-project-1",
  onlineRootLinkDraft: "https://tenant.sharepoint.com/sites/project/shared-project-1",
  isConnecting: false,
  status: "connected",
  enabled: true,
  newFolderName: "",
  resolveProgress: 0,
  isEditingSetup: false,
  isLocalProvider: true,
  isSharedProject: true,
  canManageGlobal: false,
  hasPersonalLocalRoot: true,
  personalMicrosoftStatus: "disconnected",
  isLoadingPersonalMicrosoftStatus: false,
  isMicrosoftOnlineRoot: true,
};

describe("DocHub shared project UI", () => {
  it("keeps global provider settings read-only but permits a personal folder", () => {
    render(
      <DocHubSetupWizard
        state={sharedState as any}
        actions={actions as any}
        setters={setters as any}
        showModal={vi.fn()}
      />,
    );

    expect(screen.getByText(/Výběr se uloží jen pro váš účet a toto zařízení/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Google Drive/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Lokální synchronizovaná složka/ })).toBeDisabled();
    expect(screen.getByText("2) Moje cesta na tomto zařízení")).toBeVisible();
    expect(screen.getByRole("button", { name: /Vybrat složku na tomto zařízení/ })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Cesta k synchronizované složce" })).toHaveValue(sharedState.rootLink);
    expect(screen.getByRole("button", { name: "Odebrat moji cestu" })).toBeEnabled();
    expect(screen.queryByText("Online otevření pro web a sdílené uživatele")).not.toBeInTheDocument();
  });

  it("offers the owner-provided online link as a fallback", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <DocHubStatusCard
        state={sharedState as any}
        actions={actions as any}
        setters={setters as any}
        showModal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Otevřít online" }));
    expect(openSpy).toHaveBeenCalledWith(
      sharedState.onlineRootLink,
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.getByText("Lokální synchronizovaná složka")).toBeVisible();
    expect(screen.getByText("Používá se vaše osobní cesta na tomto zařízení.")).toBeVisible();
    openSpy.mockRestore();
  });

  it("nabizi sdilenemu uzivateli osobni Microsoft prihlaseni pro online mapovani", () => {
    render(
      <DocHubSetupWizard
        state={{ ...sharedState, hasPersonalLocalRoot: false } as any}
        actions={actions as any}
        setters={setters as any}
        showModal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Přihlásit k Microsoftu pro online otevření" }));
    expect(actions.connectPersonalMicrosoft).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Online otevření v prohlížeči (volitelné)")).toBeVisible();
    expect(screen.getByText(/Ve webové verzi umožní otevřít správnou složku/)).toBeVisible();
  });

  it("validates a manually entered local path before opening it", () => {
    actions.resolveRoot.mockClear();
    actions.openRoot.mockClear();
    render(
      <DocHubSetupWizard
        state={{ ...sharedState, hasPersonalLocalRoot: false } as any}
        actions={actions as any}
        setters={setters as any}
        showModal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Připojit složku" }));
    expect(actions.resolveRoot).toHaveBeenCalledTimes(1);
    expect(actions.openRoot).not.toHaveBeenCalled();
  });

  it("vysvětluje vlastníkovi rozdíl mezi lokální synchronizací a online odkazem", () => {
    render(
      <DocHubSetupWizard
        state={{ ...sharedState, isSharedProject: false, canManageGlobal: true } as any}
        actions={actions as any}
        setters={setters as any}
        showModal={vi.fn()}
      />,
    );

    expect(screen.getByText("2) Sdílená složka projektu")).toBeVisible();
    expect(screen.getByText(/Synchronizaci souborů zajišťuje OneDrive/)).toBeVisible();
    expect(screen.getByText("Online otevření pro web a sdílené uživatele")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Online otevření pro web a sdílené uživatele" })).toHaveValue(sharedState.onlineRootLinkDraft);
  });
});

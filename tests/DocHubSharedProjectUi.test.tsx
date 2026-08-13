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
  onlineRootLink: "https://drive.google.com/drive/folders/project-1",
  onlineRootLinkDraft: "https://drive.google.com/drive/folders/project-1",
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

    expect(screen.getByText(/Globální napojení spravuje vlastník projektu/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Google Drive/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tender Flow Desktop/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Procházet/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Odebrat moji cestu" })).toBeEnabled();
    expect(screen.queryByText("Online odkaz pro sdílené uživatele")).not.toBeInTheDocument();
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
    openSpy.mockRestore();
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
});

import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDocHubProjectMarker } from "@shared/dochub/personalLocation";
import type { ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
  storageDelete: vi.fn(),
  selectFolder: vi.fn(),
  folderExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@infra/platform/platformAdapter")>();
  return {
    ...actual,
    isDesktop: true,
    storageAdapter: {
      ...actual.storageAdapter,
      get: mocks.storageGet,
      set: mocks.storageSet,
      delete: mocks.storageDelete,
    },
    fileSystemAdapter: {
      ...actual.fileSystemAdapter,
      folderExists: mocks.folderExists,
      readFile: mocks.readFile,
      writeFile: mocks.writeFile,
      selectFolder: mocks.selectFolder,
      grantAccess: vi.fn().mockResolvedValue(true),
    },
  };
});

vi.mock("../services/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock("../services/functionsClient", () => ({ invokeAuthedFunction: mocks.invokeAuthedFunction }));

import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";

const project = (id: string, ownerId = "owner-1"): ProjectDetails => ({
  id,
  ownerId,
  title: id,
  categories: [],
  docHubEnabled: true,
  docHubStatus: "connected",
  docHubProvider: "onedrive",
  docHubRootLink: `C:\\Owner\\${id}`,
  docHubRootId: `connection:${id}`,
});


vi.mock("@/services/templateService", () => ({
  getProjectTemplateSelection: vi.fn(async () => undefined),
  getTemplateById: vi.fn(async () => undefined),
  saveProjectTemplateSelection: vi.fn(),
}));
vi.mock("@features/projects/documents/ui/TemplateManager", () => ({ TemplateManager: () => null }));
vi.mock("@shared/routing/router", () => ({ useLocation: () => ({ search: "?documentsSubTab=dochub" }) }));

const disconnectedProject: ProjectDetails = {
  ...project("project-1"),
  docHubEnabled: false,
  docHubStatus: "disconnected",
  docHubRootLink: "",
  docHubRootId: null,
};

describe("desktop folder connection in project documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageGet.mockResolvedValue(null);
    mocks.storageSet.mockResolvedValue(undefined);
    mocks.folderExists.mockResolvedValue(true);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Selected", name: "Selected" });
  });

  it("shows the connection error and allows dismissing it and retrying", async () => {
    mocks.folderExists.mockResolvedValue(false);
    const onUpdate = vi.fn();
    await act(async () => {
      render(<ProjectDocuments project={disconnectedProject} onUpdate={onUpdate}
        currentUserId="owner-1" canDocHub canTemplates={false} autoShortenProjectDocs={false} />);
    });
    const selectFolder = screen.getByRole("button", { name: /Vybrat složku na tomto zařízení/ });
    fireEvent.click(selectFolder);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Chyba výběru")).toBeVisible();
    expect(within(dialog).getByText(/Vybraná složka neexistuje nebo k ní aplikace nemá přístup/)).toBeVisible();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(mocks.storageSet).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(selectFolder).toBeEnabled();
    fireEvent.click(selectFolder);
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  it("shows success and the structure after project refresh overlaps the folder save", async () => {
    let finishUpdate: (() => void) | undefined;
    function Fixture() {
      const [currentProject, setProject] = useState(disconnectedProject);
      return <ProjectDocuments project={currentProject}
        onUpdate={(updates) => {
          setProject(previous => ({ ...previous, ...updates }));
          return new Promise<void>(resolve => { finishUpdate = resolve; });
        }}
        currentUserId="owner-1" canDocHub canTemplates={false} autoShortenProjectDocs={false} />;
    }
    await act(async () => { render(<Fixture />); });
    fireEvent.click(screen.getByRole("button", { name: /Vybrat složku na tomto zařízení/ }));
    await waitFor(() => expect(finishUpdate).toBeTypeOf("function"));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Cesta k synchronizované složce" })).toHaveValue("D:\\Selected"));
    await act(async () => { finishUpdate?.(); });

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText('Složka "Selected" byla vybrána.')).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.getByRole("textbox", { name: "Cesta k synchronizované složce" })).toHaveValue("D:\\Selected");
    expect(screen.getByRole("button", { name: /Synchronizovat/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Otevřít složku/ })).toBeEnabled();
  });
});

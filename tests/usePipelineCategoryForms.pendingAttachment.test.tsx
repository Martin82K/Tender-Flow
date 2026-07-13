import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineCategoryForms } from "@/features/projects/model/usePipelineCategoryForms";
import { PROJECT_DETAILS_KEYS } from "@/hooks/queries/useProjectDetailsQuery";
import type { ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  copyPendingBudgetAttachment: vi.fn(),
  saveLocalBudgetAttachment: vi.fn(),
  getLocalBudgetAttachment: vi.fn(),
}));

vi.mock("@/services/budgetAttachmentService", () => ({
  copyPendingBudgetAttachment: mocks.copyPendingBudgetAttachment,
}));

vi.mock("@/features/projects/model/budgetAttachmentLocalStore", () => ({
  saveLocalBudgetAttachment: mocks.saveLocalBudgetAttachment,
  getLocalBudgetAttachment: mocks.getLocalBudgetAttachment,
}));

vi.mock("@/features/projects/api", () => ({
  fetchLinkedTenderPlanDates: vi.fn(),
}));

const formData = {
  title: "Betony",
  sodBudget: "100000",
  planBudget: "90000",
  description: "",
  workItems: [],
  budgetAttachment: null,
  pendingBudgetAttachment: {
    sourcePath: "/Users/tester/Downloads/rozpocet.xlsx",
    fileName: "rozpocet.xlsx",
    size: 1234,
  },
  deadline: "",
  realizationStart: "",
  realizationEnd: "",
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail("project-1"), {
    id: "project-1",
    title: "Projekt",
    location: "",
    categories: [{
      id: "cat_123",
      title: "Betony",
      budget: "0 Kč",
      sodBudget: 0,
      planBudget: 0,
      status: "open",
      subcontractorCount: 0,
      description: "",
    }],
  } as ProjectDetails);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe("usePipelineCategoryForms pending příloha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(123);
    mocks.copyPendingBudgetAttachment.mockResolvedValue({
      source: "dochub",
      fileName: "rozpocet.xlsx",
      relativePath: "rozpocet.xlsx",
      size: 1234,
      selectedAt: "2026-07-13T10:00:00.000Z",
      enabled: true,
    });
  });

  it("dodrží pořadí databáze, složka, kopie a lokální reference", async () => {
    const order: string[] = [];
    const onAddCategory = vi.fn(async () => {
      order.push("database");
    });
    const resolveDesktopTenderFolderPath = vi.fn(async () => {
      order.push("folder");
      return "/Projects/Stavba/Betony";
    });
    mocks.copyPendingBudgetAttachment.mockImplementation(async () => {
      order.push("copy");
      return {
        source: "dochub",
        fileName: "rozpocet.xlsx",
        relativePath: "rozpocet.xlsx",
        size: 1234,
        selectedAt: "2026-07-13T10:00:00.000Z",
        enabled: true,
      };
    });
    mocks.saveLocalBudgetAttachment.mockImplementation(() => {
      order.push("reference");
    });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePipelineCategoryForms({
        projectId: "project-1",
        onAddCategory,
        resolveDesktopTenderFolderPath,
        showAlert: vi.fn(),
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.setIsAddModalOpen(true);
      await result.current.handleCreateCategoryFromModal(formData);
    });

    expect(order).toEqual(["database", "folder", "copy", "reference"]);
    expect(result.current.isAddModalOpen).toBe(false);
    expect(
      queryClient
        .getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail("project-1"))
        ?.categories[0]?.budgetAttachment,
    ).toEqual(expect.objectContaining({ relativePath: "rozpocet.xlsx" }));
  });

  it("při chybě databáze nekopíruje ani neukládá referenci", async () => {
    const showAlert = vi.fn();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePipelineCategoryForms({
        projectId: "project-1",
        onAddCategory: vi.fn().mockRejectedValue(new Error("insert failed")),
        resolveDesktopTenderFolderPath: vi.fn(),
        showAlert,
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.setIsAddModalOpen(true);
      await result.current.handleCreateCategoryFromModal(formData);
    });

    expect(mocks.copyPendingBudgetAttachment).not.toHaveBeenCalled();
    expect(mocks.saveLocalBudgetAttachment).not.toHaveBeenCalled();
    expect(result.current.isAddModalOpen).toBe(true);
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "VŘ se nepodařilo vytvořit",
      message: "insert failed",
    }));
  });

  it("po chybě kopie oznámí částečný úspěch a nevytvoří falešnou referenci", async () => {
    mocks.copyPendingBudgetAttachment.mockRejectedValue(new Error("copy failed"));
    const showAlert = vi.fn();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePipelineCategoryForms({
        projectId: "project-1",
        onAddCategory: vi.fn().mockResolvedValue(undefined),
        resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
        showAlert,
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.setIsAddModalOpen(true);
      await result.current.handleCreateCategoryFromModal(formData);
    });

    expect(mocks.saveLocalBudgetAttachment).not.toHaveBeenCalled();
    expect(result.current.isAddModalOpen).toBe(false);
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "VŘ vytvořeno bez přílohy",
      message: expect.stringContaining("copy failed"),
    }));
  });
});

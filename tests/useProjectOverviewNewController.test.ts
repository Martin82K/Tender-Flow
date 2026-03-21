import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "../types";
import { useProjectOverviewNewController } from "../features/projects/model/useProjectOverviewNewController";

const buildProject = (overrides: Partial<ProjectDetails> = {}): ProjectDetails => ({
  id: "project-1",
  title: "Projekt 1",
  investor: "Původní investor",
  technicalSupervisor: "Původní TDI",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Původní stavbyvedoucí",
  constructionManager: "Původní CM",
  constructionTechnician: "Původní CT",
  plannedCost: 1000000,
  categories: [],
  ...overrides,
});

describe("useProjectOverviewNewController", () => {
  it("reinitializes infoForm when project identity changes during active edit", () => {
    const onUpdate = vi.fn();
    const projectA = buildProject();

    const { result, rerender } = renderHook(
      ({ project }) =>
        useProjectOverviewNewController({
          project,
          onUpdate,
          searchQuery: "",
        }),
      {
        initialProps: { project: projectA },
      },
    );

    act(() => {
      result.current.setEditingInfo(true);
      result.current.setInfoForm((prev) => ({
        ...prev,
        investor: "Edited investor A",
        location: "Brno",
      }));
    });

    const projectB = buildProject({
      id: "project-2",
      investor: "Investor B",
      location: "Ostrava",
    });

    rerender({ project: projectB });

    expect(result.current.editingInfo).toBe(false);
    expect(result.current.infoForm.investor).toBe("Investor B");
    expect(result.current.infoForm.location).toBe("Ostrava");
  });
});

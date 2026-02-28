import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "../types";
import { useProjectOverviewNewController } from "../features/projects/model/useProjectOverviewNewController";

const buildProject = (): ProjectDetails => ({
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
});

describe("useProjectOverviewNewController", () => {
  it("nepřepíše infoForm během aktivní editace při změně reference project", () => {
    const onUpdate = vi.fn();
    const initialProject = buildProject();

    const { result, rerender } = renderHook(
      ({ project }) =>
        useProjectOverviewNewController({
          project,
          onUpdate,
          searchQuery: "",
        }),
      {
        initialProps: { project: initialProject },
      },
    );

    act(() => {
      result.current.setEditingInfo(true);
    });

    act(() => {
      result.current.setInfoForm((prev) => ({
        ...prev,
        investor: "Nový investor",
        location: "Brno",
        finishDate: "2027-01-15",
        siteManager: "Nový stavbyvedoucí",
      }));
    });

    rerender({
      project: {
        ...initialProject,
      },
    });

    expect(result.current.infoForm.investor).toBe("Nový investor");
    expect(result.current.infoForm.location).toBe("Brno");
    expect(result.current.infoForm.finishDate).toBe("2027-01-15");
    expect(result.current.infoForm.siteManager).toBe("Nový stavbyvedoucí");
  });
});

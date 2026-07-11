import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "@/types";

const projectsQueryMock = vi.hoisted(() => ({
  value: {
    data: undefined as Project[] | undefined,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@features/projects/hooks/useProjectsQuery", () => ({
  useProjectsQuery: () => projectsQueryMock.value,
}));

import { useProjectsState } from "@features/projects/model/useProjectsState";

describe("useProjectsState", () => {
  it("vrací prázdný seznam, když query ještě nemá data", () => {
    projectsQueryMock.value = {
      data: undefined,
      isLoading: true,
      isError: false,
    };

    const { result } = renderHook(() => useProjectsState());

    expect(result.current.projects).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("vystaví seznam zakázek bez změny identity položek", () => {
    const project = {
      id: "project-1",
      name: "Rekonstrukce haly",
      location: "Praha",
      status: "tender",
    } as Project;
    projectsQueryMock.value = {
      data: [project],
      isLoading: false,
      isError: false,
    };

    const { result } = renderHook(() => useProjectsState());

    expect(result.current.projects).toEqual([project]);
    expect(result.current.projects[0]).toBe(project);
  });
});

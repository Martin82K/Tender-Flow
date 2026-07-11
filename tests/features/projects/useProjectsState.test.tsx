import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";

const projectsQueryMock = vi.hoisted(() => ({
  identity: {
    id: "user-1",
    email: "user@example.com",
    role: "user",
  } as AuthIdentity | null,
  input: null as { user: AuthIdentity | null } | null,
  value: {
    data: undefined as Project[] | undefined,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@features/projects/hooks/useProjectsQuery", () => ({
  useProjectsQuery: (input: { user: AuthIdentity | null }) => {
    projectsQueryMock.input = input;
    return projectsQueryMock.value;
  },
}));

vi.mock("@shared/auth/AuthIdentityContext", () => ({
  useAuthIdentity: () => projectsQueryMock.identity,
}));

import { useProjectsState } from "@features/projects/model/useProjectsState";

describe("useProjectsState", () => {
  beforeEach(() => {
    projectsQueryMock.identity = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
    };
    projectsQueryMock.input = null;
  });

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
    expect(projectsQueryMock.input).toEqual({ user: projectsQueryMock.identity });
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

  it("předá do query odhlášenou identitu jako null", () => {
    projectsQueryMock.identity = null;

    renderHook(() => useProjectsState());

    expect(projectsQueryMock.input).toEqual({ user: null });
  });
});

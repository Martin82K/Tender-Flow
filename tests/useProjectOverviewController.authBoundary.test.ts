import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useContactsQuery: vi.fn(),
  useOverviewTenantDataQuery: vi.fn(),
  isDemoSession: vi.fn(),
  isUserAdmin: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@features/contacts/hooks/useContactsQuery", () => ({
  useContactsQuery: mocks.useContactsQuery,
}));

vi.mock("@features/projects/hooks/useOverviewTenantDataQuery", () => ({
  useOverviewTenantDataQuery: mocks.useOverviewTenantDataQuery,
}));

vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: {
    isDemoSession: mocks.isDemoSession,
  },
}));

vi.mock("@/shared/auth/adminAccess", () => ({
  isUserAdmin: mocks.isUserAdmin,
}));

import { useProjectOverviewController } from "@features/projects/model/useProjectOverviewController";

describe("useProjectOverviewController auth boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: {
        id: "legacy-user",
        role: "user",
        email: "legacy@example.com",
      },
    });
    mocks.useContactsQuery.mockReturnValue({ data: [] });
    mocks.useOverviewTenantDataQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mocks.isDemoSession.mockReturnValue(false);
    mocks.isUserAdmin.mockImplementation((email?: string) => email === "admin@example.com");
  });

  it("forwards the explicitly supplied identity to user-scoped queries", () => {
    renderHook(() =>
      useProjectOverviewController({
        projects: [],
        projectDetails: {},
        user: {
          id: "explicit-user",
          role: "admin",
          email: "admin@example.com",
        },
      }),
    );

    expect(mocks.useContactsQuery).toHaveBeenCalledWith({
      userId: "explicit-user",
      userRole: "admin",
    });
    expect(mocks.useOverviewTenantDataQuery).toHaveBeenCalledWith({
      userId: "explicit-user",
      isDemoSession: false,
    });
    expect(mocks.isUserAdmin).toHaveBeenCalledWith("admin@example.com");
    expect(mocks.useAuth).not.toHaveBeenCalled();
  });

  it("keeps user-scoped queries disabled when no identity is supplied", () => {
    renderHook(() =>
      useProjectOverviewController({
        projects: [],
        projectDetails: {},
        user: null,
      }),
    );

    expect(mocks.useContactsQuery).toHaveBeenCalledWith({
      userId: undefined,
      userRole: undefined,
    });
    expect(mocks.useOverviewTenantDataQuery).toHaveBeenCalledWith({
      userId: undefined,
      isDemoSession: false,
    });
    expect(mocks.isUserAdmin).toHaveBeenCalledWith(undefined);
    expect(mocks.useAuth).not.toHaveBeenCalled();
  });
});

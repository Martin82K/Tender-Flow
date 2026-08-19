import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMyOrganizations: vi.fn(),
}));

vi.mock("@features/organization", () => ({
  organizationService: {
    getMyOrganizations: mocks.getMyOrganizations,
  },
}));

import { useProjectOrganizationName } from "@features/projects/pipeline/model/useProjectOrganizationName";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useProjectOrganizationName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyOrganizations.mockResolvedValue([
      { organization_id: "organization-a", organization_name: "Organizace A" },
      { organization_id: "organization-b", organization_name: "Organizace B" },
    ]);
  });

  it("použije organizaci exportovaného projektu místo výchozí organizace uživatele", async () => {
    const { result } = renderHook(() => useProjectOrganizationName({
      projectOrganizationId: "organization-b",
      activeOrganizationId: "organization-a",
      activeOrganizationName: "Organizace A",
      currentUserId: "user-1",
    }), { wrapper: createWrapper() });

    expect(result.current).toBe("Organizace");
    await waitFor(() => expect(result.current).toBe("Organizace B"));
  });

  it("neprovádí další dotaz, pokud projekt patří do aktivní organizace", () => {
    const { result } = renderHook(() => useProjectOrganizationName({
      projectOrganizationId: "organization-a",
      activeOrganizationId: "organization-a",
      activeOrganizationName: "Organizace A",
      currentUserId: "user-1",
    }), { wrapper: createWrapper() });

    expect(result.current).toBe("Organizace A");
    expect(mocks.getMyOrganizations).not.toHaveBeenCalled();
  });
});

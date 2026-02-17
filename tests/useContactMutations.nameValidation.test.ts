import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAddContactMutation,
  useBulkUpdateContactsMutation,
  useImportContactsMutation,
  useUpdateContactMutation,
} from "../hooks/mutations/useContactMutations";
import type { Subcontractor } from "../types";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  mergeContactsMock: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("../services/contactsImportService", () => ({
  mergeContacts: mocks.mergeContactsMock,
}));

vi.mock("../services/demoData", () => ({
  getDemoData: vi.fn(() => null),
  saveDemoData: vi.fn(),
}));

vi.mock("../services/fileSystemService", () => ({
  renameFolder: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      role: "user",
    },
  }),
}));

vi.mock("../shared/routing/router", () => ({
  useLocation: () => ({ pathname: "/app/project", search: "" }),
}));

vi.mock("../shared/routing/routeUtils", () => ({
  parseAppRoute: () => ({ isApp: true, view: "project", projectId: "p-1" }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    )
  );
};

const validContact: Subcontractor = {
  id: "c-1",
  company: "Validni Firma",
  specialization: ["Elektro"],
  contacts: [{ id: "p-1", name: "Kontakt", email: "a@b.cz", phone: "123" }],
  status: "available",
  name: "Kontakt",
  email: "a@b.cz",
  phone: "123",
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.fromMock.mockImplementation(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    delete: vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ error: null }),
    })),
  }));

  mocks.mergeContactsMock.mockImplementation(
    (_existing: Subcontractor[], imported: Subcontractor[]) => ({
      mergedContacts: imported,
      added: imported,
      updated: [],
      addedCount: imported.length,
      updatedCount: 0,
    }),
  );
});

describe("useContactMutations name validation", () => {
  it("blocks add mutation for invalid company name", async () => {
    const { result } = renderHook(() => useAddContactMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ ...validContact, company: "CON" }),
    ).rejects.toThrow("Neplatny nazev firmy");

    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("blocks update mutation for invalid company name", async () => {
    const { result } = renderHook(() => useUpdateContactMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        id: "c-1",
        updates: { company: "ACME/Bad" },
      }),
    ).rejects.toThrow("Neplatny nazev firmy");

    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("blocks bulk update mutation for invalid company name", async () => {
    const { result } = renderHook(() => useBulkUpdateContactsMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync([
        {
          id: "c-1",
          data: { company: "LPT1" },
        },
      ]),
    ).rejects.toThrow("Neplatny nazev firmy");

    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("blocks import mutation for invalid company name", async () => {
    const { result } = renderHook(() => useImportContactsMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        newContacts: [{ ...validContact, company: "..BadName" }],
      }),
    ).rejects.toThrow("Neplatny nazev firmy");

    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});

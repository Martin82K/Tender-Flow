import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAddContactMutation,
  useBulkUpdateContactsMutation,
  assertValidSubcontractorCompanyNameOrThrow,
  useImportContactsMutation,
  useUpdateContactMutation,
} from "../hooks/mutations/useContactMutations";
import type { Subcontractor } from "../types";
import { renameFolder } from "../services/fileSystemService";
import { CONTACT_KEYS } from "../hooks/queries/useContactsQuery";

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

const createTestContext = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    )
  );

  return { queryClient, wrapper };
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

  it("pri prejmenovani dodavatele pouzije sanitizovanou cestu DocHub slozky", async () => {
    const { queryClient, wrapper } = createTestContext();
    queryClient.setQueryData(["project", "p-1"], {
      id: "p-1",
      docHubEnabled: true,
      docHubStatus: "connected",
      docHubProvider: "onedrive",
      docHubRootLink: "C:\\DocHubRoot",
      docHubStructureV1: { tenders: "01_VYBEROVA_RIZENI" },
      categories: [{ id: "cat-1", title: "Zakladni cast" }],
      bids: {
        "cat-1": [{ subcontractorId: "c-1" }],
      },
    });
    queryClient.setQueryData(CONTACT_KEYS.list(), [
      { ...validContact, id: "c-1", company: "IZOMAT stavebniny s.r.o." },
    ]);

    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Windows" },
      configurable: true,
    });

    try {
      const { result } = renderHook(() => useUpdateContactMutation(), {
        wrapper,
      });

      await result.current.mutateAsync({
        id: "c-1",
        updates: { company: "IZOMAT stavebniny a.s" },
      });

      expect(renameFolder).toHaveBeenCalledWith(
        "C:\\DocHubRoot\\01_VYBEROVA_RIZENI\\Zakladni cast\\IZOMAT stavebniny s.r.o",
        "C:\\DocHubRoot\\01_VYBEROVA_RIZENI\\Zakladni cast\\IZOMAT stavebniny a.s",
        { provider: "onedrive", projectId: "p-1" },
      );
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
      });
    }
  });

  it("stale blokuje ukladani nevalidniho nazvu s koncovou teckou", () => {
    expect(() => assertValidSubcontractorCompanyNameOrThrow("IZOMAT stavebniny a.s.")).toThrow(
      "Neplatny nazev firmy",
    );
  });
});

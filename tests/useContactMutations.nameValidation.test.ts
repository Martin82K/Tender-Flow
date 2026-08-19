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
  useDeleteContactsMutation,
} from "../hooks/mutations/useContactMutations";
import type { Subcontractor } from "../types";
import { renameFolder } from "../services/fileSystemService";
import { CONTACT_KEYS } from "../hooks/queries/useContactsQuery";
import { PROJECT_DETAILS_KEYS } from "../hooks/queries/useProjectDetailsQuery";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  mergeContactsMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateMock: vi.fn(),
  updateSelectMock: vi.fn(),
  updateMaybeSingleMock: vi.fn(),
  deleteInMock: vi.fn(),
  deleteMock: vi.fn(),
  insertMock: vi.fn(),
  resolveEffectiveProjectDocHubRootMock: vi.fn(),
}));

vi.mock("@features/projects/dochub/model/personalRoot", () => ({
  resolveEffectiveProjectDocHubRoot: mocks.resolveEffectiveProjectDocHubRootMock,
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
  isDemoSession: vi.fn(() => false),
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

  mocks.updateMaybeSingleMock.mockResolvedValue({ data: { id: "c-1" }, error: null });
  mocks.updateSelectMock.mockReturnValue({ maybeSingle: mocks.updateMaybeSingleMock });
  mocks.updateEqMock.mockReturnValue({ select: mocks.updateSelectMock });
  mocks.updateMock.mockImplementation(() => ({
    eq: mocks.updateEqMock,
  }));
  mocks.deleteInMock.mockResolvedValue({ error: null });
  mocks.deleteMock.mockReturnValue({ in: mocks.deleteInMock });
  mocks.insertMock.mockResolvedValue({ error: null });
  mocks.resolveEffectiveProjectDocHubRootMock.mockResolvedValue("D:\\Personal\\Project");

  mocks.fromMock.mockImplementation(() => ({
    insert: mocks.insertMock,
    update: mocks.updateMock,
    delete: mocks.deleteMock,
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
  it("blocks add mutation when the same normalized company name already exists", async () => {
    const { queryClient, wrapper } = createTestContext();
    queryClient.setQueryData(CONTACT_KEYS.scopedList("u-1"), [
      { ...validContact, company: "Baustav" },
    ]);
    const { result } = renderHook(() => useAddContactMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        ...validContact,
        id: "c-2",
        company: "BAUSTAV",
      }),
    ).rejects.toThrow(/již existuje/i);

    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it("allows a differently named center even when IČO and email match", async () => {
    const { queryClient, wrapper } = createTestContext();
    queryClient.setQueryData(CONTACT_KEYS.scopedList("u-1"), [
      { ...validContact, company: "Baustav", ico: "12345678", email: "info@baustav.cz" },
    ]);
    const { result } = renderHook(() => useAddContactMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        ...validContact,
        id: "c-2",
        company: "Baustav - zemní práce",
        ico: "12345678",
        email: "info@baustav.cz",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "c-2" }));

    expect(mocks.insertMock).toHaveBeenCalledTimes(1);
  });

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

  it("maps a database name conflict during bulk import to the user-facing message", async () => {
    mocks.insertMock.mockResolvedValueOnce({
      error: {
        code: "23505",
        constraint: "subcontractors_tenant_company_name_key",
        message: "SUBCONTRACTOR_NAME_CONFLICT",
      },
    });
    const { result } = renderHook(() => useImportContactsMutation(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({
      newContacts: [{ ...validContact, company: "Baustav" }],
    })).rejects.toThrow(/Subdodavatel s názvem „Baustav“ již existuje/i);
  });

  it("bulk update zapisuje region do databaze", async () => {
    const { result } = renderHook(() => useBulkUpdateContactsMutation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync([
      {
        id: "c-1",
        data: { region: "Karlovarský kraj" },
      },
    ]);

    expect(mocks.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "Karlovarský kraj",
      }),
    );
    expect(mocks.updateEqMock).toHaveBeenCalledWith("id", "c-1");
  });

  it("optimisticky aktualizuje uživatelsky scoped cache kontaktů", async () => {
    const { queryClient, wrapper } = createTestContext();
    const scopedKey = CONTACT_KEYS.scopedList("u-1");
    queryClient.setQueryData(scopedKey, [validContact]);
    const { result } = renderHook(() => useUpdateContactMutation(), { wrapper });

    await result.current.mutateAsync({
      id: "c-1",
      updates: { company: "Nová firma" },
    });

    expect(queryClient.getQueryData<Subcontractor[]>(scopedKey)?.[0].company).toBe(
      "Nová firma",
    );
  });

  it("maže pouze zadané testovací ID a odstraní je ze scoped cache", async () => {
    const { queryClient, wrapper } = createTestContext();
    const scopedKey = CONTACT_KEYS.scopedList("u-1");
    queryClient.setQueryData(scopedKey, [
      validContact,
      { ...validContact, id: "c-safe", company: "Bezpečná testovací firma" },
    ]);
    const { result } = renderHook(() => useDeleteContactsMutation(), { wrapper });

    await result.current.mutateAsync(["c-safe"]);

    expect(mocks.deleteMock).toHaveBeenCalledOnce();
    expect(mocks.deleteInMock).toHaveBeenCalledWith("id", ["c-safe"]);
    expect(queryClient.getQueryData<Subcontractor[]>(scopedKey)?.map(({ id }) => id)).toEqual(["c-1"]);
  });

  it("nepovažuje nulový databázový UPDATE za úspěšné uložení", async () => {
    mocks.updateMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useUpdateContactMutation(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({
      id: "c-1",
      updates: { note: "Změna" },
    })).rejects.toThrow("Kontakt nebyl aktualizován");
  });

  it("pri prejmenovani dodavatele pouzije sanitizovanou cestu DocHub slozky", async () => {
    const { queryClient, wrapper } = createTestContext();
    queryClient.setQueryData(PROJECT_DETAILS_KEYS.detail("p-1"), {
      id: "p-1",
      docHubEnabled: true,
      docHubStatus: "connected",
      docHubProvider: "onedrive",
      docHubRootLink: "C:\\DocHubRoot",
      docHubStructureV1: { tenders: "01_VYBEROVA_RIZENI" },
      categories: [{ id: "cat-1", title: "Elektro/VZT" }],
      bids: {
        "cat-1": [{ subcontractorId: "c-1" }],
      },
    });
    queryClient.setQueryData(CONTACT_KEYS.scopedList("u-1"), [
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
        "D:\\Personal\\Project\\01_VYBEROVA_RIZENI\\Elektro_VZT\\IZOMAT stavebniny s.r.o",
        "D:\\Personal\\Project\\01_VYBEROVA_RIZENI\\Elektro_VZT\\IZOMAT stavebniny a.s",
        { provider: "onedrive", projectId: "p-1" },
      );
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
      });
    }
  });

  it("neprejmenuje slozku dodavatele po neuspesne databazove mutaci", async () => {
    const { queryClient, wrapper } = createTestContext();
    queryClient.setQueryData(PROJECT_DETAILS_KEYS.detail("p-1"), {
      id: "p-1",
      docHubEnabled: true,
      docHubStatus: "connected",
      docHubProvider: "onedrive",
      docHubRootLink: "C:\\DocHubRoot",
      categories: [{ id: "cat-1", title: "Zakladni cast" }],
      bids: { "cat-1": [{ subcontractorId: "c-1" }] },
    });
    queryClient.setQueryData(CONTACT_KEYS.scopedList("u-1"), [{ ...validContact, id: "c-1", company: "Stary nazev" }]);
    mocks.updateMaybeSingleMock.mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });
    const { result } = renderHook(() => useUpdateContactMutation(), { wrapper });

    await expect(result.current.mutateAsync({
      id: "c-1",
      updates: { company: "Novy nazev" },
    })).rejects.toThrow("database unavailable");

    expect(renameFolder).not.toHaveBeenCalled();
  });

  it("stale blokuje ukladani nevalidniho nazvu s koncovou teckou", () => {
    expect(() => assertValidSubcontractorCompanyNameOrThrow("IZOMAT stavebniny a.s.")).toThrow(
      "Neplatny nazev firmy",
    );
  });
});

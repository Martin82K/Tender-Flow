import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectConsoleError } from "./utils/consoleGuard";

import type { Subcontractor } from "@/types";

const mocks = vi.hoisted(() => ({
  insertSubcontractor: vi.fn(),
  updateSubcontractor: vi.fn(),
}));

vi.mock("@/features/projects/api", () => ({
  insertSubcontractor: mocks.insertSubcontractor,
  updateSubcontractor: mocks.updateSubcontractor,
}));

vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: {
    getDemoData: vi.fn(() => null),
    saveDemoData: vi.fn(),
  },
}));

import { usePipelineContactsController } from "@/features/projects/model/usePipelineContactsController";

const contact: Subcontractor = {
  id: "contact-1",
  company: "Bezpečná firma",
  specialization: ["Elektro"],
  contacts: [],
  status: "available",
};

describe("usePipelineContactsController persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("použije společnou aplikační mutaci při vytvoření kontaktu", async () => {
    const persistNewContact = vi.fn().mockResolvedValue(undefined);
    const externalContacts = [contact];
    const { result } = renderHook(() =>
      usePipelineContactsController({
        externalContacts,
        userRole: "user",
        projectDataId: "project-1",
        showAlert: vi.fn(),
        persistNewContact,
      }),
    );
    await act(async () => {
      await result.current.handleSaveNewContact(contact);
    });

    expect(persistNewContact).toHaveBeenCalledWith(contact);
    expect(mocks.insertSubcontractor).not.toHaveBeenCalled();
    expect(result.current.localContacts).toEqual([contact]);
  });

  it("přidá kontakt lokálně i když persist callback neaktualizuje externí cache", async () => {
    const persistNewContact = vi.fn().mockResolvedValue(undefined);
    const externalContacts: Subcontractor[] = [];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      showAlert: vi.fn(),
      persistNewContact,
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(contact);
    });

    expect(persistNewContact).toHaveBeenCalledWith(contact);
    expect(result.current.localContacts).toEqual([contact]);
  });

  it("zablokuje vytvoření kontaktu se shodným názvem", async () => {
    const persistNewContact = vi.fn().mockResolvedValue(undefined);
    const showAlert = vi.fn();
    const duplicate = { ...contact, id: "contact-2", company: "BEZPEČNÁ FIRMA" };
    const externalContacts = [contact];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      showAlert,
      persistNewContact,
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(duplicate);
    });

    expect(persistNewContact).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Duplicitní název subdodavatele",
      variant: "danger",
    }));
  });

  it("povolí samostatné středisko s odlišným názvem", async () => {
    const persistNewContact = vi.fn().mockResolvedValue(undefined);
    const center = { ...contact, id: "contact-2", company: "Bezpečná firma - servis" };
    const externalContacts = [contact];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      showAlert: vi.fn(),
      persistNewContact,
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(center);
    });

    expect(persistNewContact).toHaveBeenCalledWith(center);
  });

  it("povolí shodný název při vytvoření kontaktu v jiné organizaci", async () => {
    const persistNewContact = vi.fn().mockResolvedValue(undefined);
    const existingContact = { ...contact, organizationId: "org-other" };
    const newContact = { ...contact, id: "contact-2", organizationId: "org-target" };
    const externalContacts = [existingContact];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      organizationId: "org-target",
      showAlert: vi.fn(),
      persistNewContact,
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(newContact);
    });

    expect(persistNewContact).toHaveBeenCalledWith(newContact);
  });

  it("přidá kontakt lokálně ve fallback větvi bez společné mutace", async () => {
    mocks.insertSubcontractor.mockResolvedValue({ data: contact, error: null });
    const externalContacts: Subcontractor[] = [];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      showAlert: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(contact);
    });

    expect(mocks.insertSubcontractor).toHaveBeenCalledWith(contact, undefined);
    expect(result.current.localContacts).toEqual([contact]);
  });

  it("převede databázový konflikt ve fallback větvi na srozumitelné upozornění", async () => {
    expectConsoleError("Error saving contact to Supabase:");
    expectConsoleError("Unexpected error saving contact:");
    mocks.insertSubcontractor.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "SUBCONTRACTOR_NAME_CONFLICT" },
    });
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts: [],
      userRole: "user",
      projectDataId: "project-1",
      showAlert,
    }));

    await act(async () => {
      await result.current.handleSaveNewContact(contact);
    });

    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Duplicitní název subdodavatele",
      message: expect.stringMatching(/již existuje/i),
    }));
  });

  it("použije společnou aplikační mutaci při editaci kontaktu", async () => {
    const persistContactUpdate = vi.fn().mockResolvedValue(undefined);
    const updatedContact = { ...contact, company: "Nový název" };
    const externalContacts = [contact];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      showAlert: vi.fn(),
      persistContactUpdate,
    }));

    await act(async () => {
      await result.current.handleUpdateContact(updatedContact);
    });

    expect(persistContactUpdate).toHaveBeenCalledWith(updatedContact);
    expect(mocks.updateSubcontractor).not.toHaveBeenCalled();
    expect(result.current.localContacts).toEqual([updatedContact]);
  });

  it("povolí při editaci název používaný pouze v jiné organizaci", async () => {
    const persistContactUpdate = vi.fn().mockResolvedValue(undefined);
    const editedContact = {
      ...contact,
      company: "Sdílený název",
      organizationId: "org-target",
    };
    const otherOrganizationContact = {
      ...contact,
      id: "contact-other",
      company: "Sdílený název",
      organizationId: "org-other",
    };
    const externalContacts = [
      { ...contact, organizationId: "org-target" },
      otherOrganizationContact,
    ];
    const { result } = renderHook(() => usePipelineContactsController({
      externalContacts,
      userRole: "user",
      projectDataId: "project-1",
      organizationId: "org-target",
      showAlert: vi.fn(),
      persistContactUpdate,
    }));

    await act(async () => {
      await result.current.handleUpdateContact(editedContact);
    });

    expect(persistContactUpdate).toHaveBeenCalledWith(editedContact);
  });
});

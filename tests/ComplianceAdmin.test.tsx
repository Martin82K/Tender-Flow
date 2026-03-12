import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComplianceAdmin } from "@/features/settings/ComplianceAdmin";

const mockState = vi.hoisted(() => ({
  getComplianceOverviewAdmin: vi.fn(),
  createDataSubjectRequestAdmin: vi.fn(),
  updateDataSubjectRequestStatusAdmin: vi.fn(),
  createBreachCaseAdmin: vi.fn(),
  updateBreachCaseStatusAdmin: vi.fn(),
  exportDataSubjectAdmin: vi.fn(),
  anonymizeDataSubjectAdmin: vi.fn(),
  saveComplianceRetentionPolicyAdmin: vi.fn(),
  saveSubprocessorAdmin: vi.fn(),
  runComplianceRetentionPurgeAdmin: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock("@/features/settings/api/complianceAdminService", () => ({
  getComplianceOverviewAdmin: mockState.getComplianceOverviewAdmin,
  createDataSubjectRequestAdmin: mockState.createDataSubjectRequestAdmin,
  updateDataSubjectRequestStatusAdmin: mockState.updateDataSubjectRequestStatusAdmin,
  createBreachCaseAdmin: mockState.createBreachCaseAdmin,
  updateBreachCaseStatusAdmin: mockState.updateBreachCaseStatusAdmin,
  exportDataSubjectAdmin: mockState.exportDataSubjectAdmin,
  anonymizeDataSubjectAdmin: mockState.anonymizeDataSubjectAdmin,
  saveComplianceRetentionPolicyAdmin: mockState.saveComplianceRetentionPolicyAdmin,
  saveSubprocessorAdmin: mockState.saveSubprocessorAdmin,
  runComplianceRetentionPurgeAdmin: mockState.runComplianceRetentionPurgeAdmin,
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: mockState.showAlert,
    showConfirm: mockState.showConfirm,
  }),
}));

describe("ComplianceAdmin", () => {
  const overviewPayload = {
    checklistItems: [
      {
        id: "1",
        area: "Logování",
        title: "Sdílená sanitizace logů",
        description: "Popis",
        status: "implemented",
        priority: "P0",
      },
      {
        id: "2",
        area: "Souhlasy",
        title: "Cookie consent vrstva",
        description: "Popis",
        status: "missing",
        priority: "P1",
      },
    ],
    retentionPolicies: [
      {
        id: "ret-1",
        category: "Incident logy",
        purpose: "Diagnostika",
        retentionDays: 60,
        status: "implemented",
      },
    ],
    dsrQueue: [
      {
        id: "dsr-1",
        requestType: "export",
        subjectLabel: "Export osobních údajů",
        status: "new",
        dueAt: "2026-03-19",
      },
    ],
    breachCases: [
      {
        id: "breach-1",
        title: "Breach register",
        status: "triage",
        riskLevel: "high",
        linkedIncidentId: null,
      },
    ],
    subprocessors: [
      {
        id: "sub-1",
        name: "Supabase",
        region: "EU",
        purpose: "Hosting",
        transferMechanism: "SCC",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getComplianceOverviewAdmin.mockResolvedValue(overviewPayload);
    mockState.createDataSubjectRequestAdmin.mockResolvedValue(undefined);
    mockState.updateDataSubjectRequestStatusAdmin.mockResolvedValue(undefined);
    mockState.createBreachCaseAdmin.mockResolvedValue(undefined);
    mockState.updateBreachCaseStatusAdmin.mockResolvedValue(undefined);
    mockState.exportDataSubjectAdmin.mockResolvedValue({
      query: "Export osobních údajů",
      generated_at: "2026-03-12T10:00:00.000Z",
      user_profiles: [],
      subcontractors: [],
      projects: [],
    });
    mockState.anonymizeDataSubjectAdmin.mockResolvedValue({
      query: "Export osobních údajů",
      anonymized_user_profiles: 1,
      anonymized_subcontractors: 2,
      anonymized_projects: 0,
      completed_at: "2026-03-12T10:00:00.000Z",
    });
    mockState.saveComplianceRetentionPolicyAdmin.mockResolvedValue(undefined);
    mockState.saveSubprocessorAdmin.mockResolvedValue(undefined);
    mockState.runComplianceRetentionPurgeAdmin.mockResolvedValue({
      admin_audit_deleted: 1,
      dsr_events_deleted: 2,
      breach_events_deleted: 3,
      completed_at: "2026-03-12T10:00:00.000Z",
    });
    mockState.showConfirm.mockResolvedValue(true);
  });

  it("zobrazí compliance sekce a načtený přehled", async () => {
    render(<ComplianceAdmin />);

    expect(
      screen.getByRole("heading", { name: "Compliance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Compliance checklist" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Retence dat" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DSR fronta" })).toBeInTheDocument();
    expect(screen.getAllByText("Breach register").length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/Sdílená sanitizace logů/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie consent vrstva/i)).toBeInTheDocument();
    expect(screen.getByText(/Supabase/i)).toBeInTheDocument();
  });

  it("umožní vytvořit DSR požadavek", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(screen.getByLabelText("Popis DSR požadavku"), {
      target: { value: "Export kontaktu" },
    });
    fireEvent.change(screen.getByLabelText("Termín DSR požadavku"), {
      target: { value: "2026-03-20" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Přidat" })[0]);

    await waitFor(() => {
      expect(mockState.createDataSubjectRequestAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: "export",
          subjectLabel: "Export kontaktu",
          dueAt: "2026-03-20",
        }),
      );
    });
  });

  it("umožní posunout stav breach case", async () => {
    render(<ComplianceAdmin />);

    expect(await screen.findByText(/breach-1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Posunout na Posouzení/i }));

    await waitFor(() => {
      expect(mockState.updateBreachCaseStatusAdmin).toHaveBeenCalledWith({
        id: "breach-1",
        status: "assessment",
      });
    });
  });

  it("umožní exportovat DSR data", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createObjectUrlMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectUrlMock = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickMock = vi.fn();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string) => {
        if (tagName === "a") {
          return {
            click: clickMock,
            set href(value: string) {},
            set download(value: string) {},
          } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      }) as typeof document.createElement);

    render(<ComplianceAdmin />);

    expect(await screen.findByText(/Export osobních údajů/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => {
      expect(mockState.exportDataSubjectAdmin).toHaveBeenCalledWith({
        query: "Export osobních údajů",
      });
    });

    createElementSpy.mockRestore();
    createObjectUrlMock.mockRestore();
    revokeObjectUrlMock.mockRestore();
  });

  it("umožní anonymizovat DSR data po potvrzení", async () => {
    render(<ComplianceAdmin />);

    expect(await screen.findByText(/Export osobních údajů/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anonymizovat" }));

    await waitFor(() => {
      expect(mockState.showConfirm).toHaveBeenCalledTimes(1);
      expect(mockState.anonymizeDataSubjectAdmin).toHaveBeenCalledWith({
        query: "Export osobních údajů",
      });
    });
  });

  it("umožní uložit retention policy", async () => {
    render(<ComplianceAdmin />);

    expect(await screen.findByText(/Incident logy/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Retence ret-1"), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() => {
      expect(mockState.saveComplianceRetentionPolicyAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ret-1",
          retentionDays: 90,
        }),
      );
    });
  });

  it("umožní spustit retention purge po potvrzení", async () => {
    render(<ComplianceAdmin />);

    fireEvent.click(await screen.findByRole("button", { name: "Spustit purge" }));

    await waitFor(() => {
      expect(mockState.showConfirm).toHaveBeenCalled();
      expect(mockState.runComplianceRetentionPurgeAdmin).toHaveBeenCalledTimes(1);
    });
  });

  it("umožní přidat subprocessor do registru", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Název subprocessoru"), {
      target: { value: "OpenAI" },
    });
    fireEvent.change(screen.getByLabelText("Region subprocessoru"), {
      target: { value: "US" },
    });
    fireEvent.change(screen.getByLabelText("Účel subprocessoru"), {
      target: { value: "AI processing" },
    });
    fireEvent.change(screen.getByLabelText("Přenosový mechanismus subprocessoru"), {
      target: { value: "SCC" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Přidat" })[2]);

    await waitFor(() => {
      expect(mockState.saveSubprocessorAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "OpenAI",
          region: "US",
          purpose: "AI processing",
          transferMechanism: "SCC",
        }),
      );
    });
  });
});

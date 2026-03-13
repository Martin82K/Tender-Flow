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
  saveBreachAssessmentAdmin: vi.fn(),
  saveBreachClassificationAdmin: vi.fn(),
  addBreachCaseTimelineEventAdmin: vi.fn(),
  markBreachNotificationAdmin: vi.fn(),
  buildBreachAuthorityReportAdmin: vi.fn(),
  exportDataSubjectAdmin: vi.fn(),
  anonymizeDataSubjectAdmin: vi.fn(),
  saveComplianceRetentionPolicyAdmin: vi.fn(),
  saveProcessingActivityAdmin: vi.fn(),
  createAccessReviewReportAdmin: vi.fn(),
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
  saveBreachAssessmentAdmin: mockState.saveBreachAssessmentAdmin,
  saveBreachClassificationAdmin: mockState.saveBreachClassificationAdmin,
  addBreachCaseTimelineEventAdmin: mockState.addBreachCaseTimelineEventAdmin,
  markBreachNotificationAdmin: mockState.markBreachNotificationAdmin,
  buildBreachAuthorityReportAdmin: mockState.buildBreachAuthorityReportAdmin,
  exportDataSubjectAdmin: mockState.exportDataSubjectAdmin,
  saveComplianceRetentionPolicyAdmin: mockState.saveComplianceRetentionPolicyAdmin,
  saveProcessingActivityAdmin: mockState.saveProcessingActivityAdmin,
  createAccessReviewReportAdmin: mockState.createAccessReviewReportAdmin,
  saveSubprocessorAdmin: mockState.saveSubprocessorAdmin,
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
        assessmentSummary: "Prvotní vyhodnocení dopadu.",
        affectedDataCategories: ["jméno", "e-mail"],
        affectedSubjectTypes: ["kontaktní osoby"],
        estimatedSubjectCount: 12,
        notificationRationale: "Existuje pravděpodobné riziko pro dotčené osoby, proto běží příprava hlášení.",
        authorityNotifiedAt: null,
        dataSubjectsNotifiedAt: null,
        createdAt: "2026-03-12T09:00:00.000Z",
      },
    ],
    breachCaseEvents: [
      {
        id: "bre-evt-1",
        breachCaseId: "breach-1",
        eventType: "created",
        summary: "Případ založen.",
        actor: "admin",
        createdAt: "2026-03-12T09:15:00.000Z",
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
    processingActivities: [
      {
        id: "ropa-1",
        activityName: "Správa kontaktů v CRM",
        purpose: "Obchodní komunikace",
        legalBasis: "plnění smlouvy",
        dataCategories: ["jméno", "e-mail"],
        retentionPolicyId: "ret-1",
        linkedSubprocessorIds: ["sub-1"],
      },
    ],
    accessReviewUsers: [
      {
        userId: "user-1",
        email: "admin@example.com",
        displayName: "Admin User",
        appRoleId: "priprava",
        appRoleLabel: "Přípravář",
        orgRoles: ["owner"],
        lastSignIn: "2026-03-01T10:00:00.000Z",
        riskFlags: ["privileged_access"],
      },
    ],
    accessAuditEntries: [
      {
        id: "audit-1",
        eventType: "user_role_changed",
        actorEmail: "boss@example.com",
        targetUserEmail: "admin@example.com",
        targetRoleId: "priprava",
        permissionKey: null,
        oldValue: "member",
        newValue: "priprava",
        summary: "Aplikační role uživatele změněna z member na priprava",
        createdAt: "2026-03-12T11:00:00.000Z",
      },
    ],
    accessReviewReports: [
      {
        id: "review-1",
        reviewScope: "all_admin_access",
        summary: "Měsíční kontrola přístupů",
        reviewedByEmail: "boss@example.com",
        totalUsers: 12,
        adminUsers: 3,
        staleUsers: 1,
        createdAt: "2026-03-12T12:00:00.000Z",
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
    mockState.saveBreachAssessmentAdmin.mockResolvedValue(undefined);
    mockState.saveBreachClassificationAdmin.mockResolvedValue(undefined);
    mockState.addBreachCaseTimelineEventAdmin.mockResolvedValue(undefined);
    mockState.markBreachNotificationAdmin.mockResolvedValue(undefined);
    mockState.buildBreachAuthorityReportAdmin.mockReturnValue({
      fileName: "uoou_podklady_breach-1.md",
      mimeType: "text/markdown;charset=utf-8",
      content: "# Podklady",
    });
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
    mockState.saveProcessingActivityAdmin.mockResolvedValue(undefined);
    mockState.createAccessReviewReportAdmin.mockResolvedValue("review-2");
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
    expect(
      screen.getByRole("heading", { name: /ROPA \/ činnosti zpracování/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Sdílená sanitizace logů/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie consent vrstva/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Správa kontaktů v CRM/i)).toBeInTheDocument();
    expect(screen.getByText(/Subprocessors: Supabase/i)).toBeInTheDocument();
    expect(screen.getByText(/Případ založen/i)).toBeInTheDocument();
    expect(screen.getByText(/Měsíční kontrola přístupů/i)).toBeInTheDocument();
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

  it("umožní uložit breach posouzení", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Posouzení breach-1"), {
      target: { value: "Rozsah potvrzen, běží právní posouzení a containment." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit posouzení" }));

    await waitFor(() => {
      expect(mockState.saveBreachAssessmentAdmin).toHaveBeenCalledWith({
        id: "breach-1",
        assessmentSummary: "Rozsah potvrzen, běží právní posouzení a containment.",
      });
    });
  });

  it("umožní uložit breach klasifikaci", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Kategorie údajů breach-1"), {
      target: { value: "jméno, e-mail, telefon" },
    });
    fireEvent.change(screen.getByLabelText("Typy subjektů breach-1"), {
      target: { value: "zákazníci, kontaktní osoby" },
    });
    fireEvent.change(screen.getByLabelText("Odhad subjektů breach-1"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Důvod hlášení breach-1"), {
      target: {
        value: "Incident má dopad na běžné kontaktní údaje a existuje pravděpodobné riziko neoprávněného přístupu.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit klasifikaci" }));

    await waitFor(() => {
      expect(mockState.saveBreachClassificationAdmin).toHaveBeenCalledWith({
        id: "breach-1",
        affectedDataCategories: ["jméno", "e-mail", "telefon"],
        affectedSubjectTypes: ["zákazníci", "kontaktní osoby"],
        estimatedSubjectCount: 25,
        notificationRationale:
          "Incident má dopad na běžné kontaktní údaje a existuje pravděpodobné riziko neoprávněného přístupu.",
      });
    });
  });

  it("umožní přidat krok do breach timeline", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Timeline breach-1"), {
      target: { value: "Interní eskalace dokončena a klíče byly rotovány." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Přidat krok do timeline" }));

    await waitFor(() => {
      expect(mockState.addBreachCaseTimelineEventAdmin).toHaveBeenCalledWith({
        breachCaseId: "breach-1",
        summary: "Interní eskalace dokončena a klíče byly rotovány.",
      });
    });
  });

  it("umožní zapsat hlášení ÚOOÚ", async () => {
    render(<ComplianceAdmin />);

    fireEvent.click(await screen.findByRole("button", { name: "Zapsat hlášení ÚOOÚ" }));

    await waitFor(() => {
      expect(mockState.markBreachNotificationAdmin).toHaveBeenCalledWith({
        id: "breach-1",
        target: "authority",
      });
    });
  });

  it("umožní stáhnout podklady pro ÚOOÚ", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createObjectUrlMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:uoou");
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

    fireEvent.click(await screen.findByRole("button", { name: "Stáhnout podklady pro ÚOOÚ" }));

    await waitFor(() => {
      expect(mockState.buildBreachAuthorityReportAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          breachCase: expect.objectContaining({ id: "breach-1" }),
        }),
      );
      expect(clickMock).toHaveBeenCalledTimes(1);
    });

    createElementSpy.mockRestore();
    createObjectUrlMock.mockRestore();
    revokeObjectUrlMock.mockRestore();
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

  it("u požadavku na výmaz jen zobrazí bezpečnostní informaci a nic nemaže", async () => {
    render(<ComplianceAdmin />);

    expect(await screen.findByText(/Export osobních údajů/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Výmaz je jen evidenční" }));

    await waitFor(() => {
      expect(mockState.showAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Mazání je vypnuté",
          variant: "info",
        }),
      );
      expect(mockState.anonymizeDataSubjectAdmin).not.toHaveBeenCalled();
    });
  });

  it("umožní uložit retention policy", async () => {
    render(<ComplianceAdmin />);

    expect(await screen.findByLabelText("Retence ret-1")).toBeInTheDocument();
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

  it("u retention purge jen zobrazí bezpečnostní informaci a nic nemaže", async () => {
    render(<ComplianceAdmin />);

    fireEvent.click(await screen.findByRole("button", { name: "Purge je vypnuté" }));

    await waitFor(() => {
      expect(mockState.showAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Mazání je vypnuté",
          variant: "info",
        }),
      );
      expect(mockState.runComplianceRetentionPurgeAdmin).not.toHaveBeenCalled();
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

  it("umožní přidat činnost zpracování do ROPA registru", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Název činnosti zpracování"), {
      target: { value: "Správa uživatelských účtů" },
    });
    fireEvent.change(screen.getByLabelText("Účel činnosti zpracování"), {
      target: { value: "Autentizace a autorizace" },
    });
    fireEvent.change(screen.getByLabelText("Právní titul činnosti zpracování"), {
      target: { value: "plnění smlouvy" },
    });
    fireEvent.change(screen.getByLabelText("Kategorie dat činnosti zpracování"), {
      target: { value: "jméno, e-mail, role" },
    });
    fireEvent.change(screen.getByLabelText("Navázaná retention policy"), {
      target: { value: "ret-1" },
    });
    const subprocessorsSelect = screen.getByLabelText(
      "Navázané subprocessory činnosti zpracování",
    ) as HTMLSelectElement;
    Array.from(subprocessorsSelect.options).forEach((option) => {
      option.selected = option.value === "sub-1";
    });
    fireEvent.change(subprocessorsSelect);
    fireEvent.click(screen.getAllByRole("button", { name: "Přidat" })[3]);

    await waitFor(() => {
      expect(mockState.saveProcessingActivityAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          activityName: "Správa uživatelských účtů",
          purpose: "Autentizace a autorizace",
          legalBasis: "plnění smlouvy",
          dataCategories: ["jméno", "e-mail", "role"],
          retentionPolicyId: "ret-1",
          linkedSubprocessorIds: ["sub-1"],
        }),
      );
    });
  });

  it("umožní uložit access review snapshot", async () => {
    render(<ComplianceAdmin />);

    fireEvent.change(await screen.findByLabelText("Shrnutí access review"), {
      target: { value: "Kontrola privilegovaných účtů a neaktivních přístupů" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit review snapshot" }));

    await waitFor(() => {
      expect(mockState.createAccessReviewReportAdmin).toHaveBeenCalledWith({
        summary: "Kontrola privilegovaných účtů a neaktivních přístupů",
      });
    });
  });
});

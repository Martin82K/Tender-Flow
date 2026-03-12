import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.insert.mockResolvedValue({ error: null });
  query.update.mockReturnValue(query);
  query.upsert.mockResolvedValue({ error: null });
  query.eq.mockResolvedValue({ error: null });

  return {
    from: vi.fn(() => query),
    rpc: vi.fn(),
    query,
  };
});

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: state.from,
    rpc: state.rpc,
  },
}));

describe("complianceAdminService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.query.select.mockReturnValue(state.query);
    state.query.order.mockReturnValue(state.query);
    state.query.insert.mockResolvedValue({ error: null });
    state.query.update.mockReturnValue(state.query);
    state.query.upsert.mockResolvedValue({ error: null });
    state.query.eq.mockResolvedValue({ error: null });
    state.rpc.mockReset();
  });

  it("vrátí fallback data při chybě čtení", async () => {
    state.query.order.mockResolvedValue({ data: null, error: new Error("fail") });

    const { getComplianceOverviewAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await getComplianceOverviewAdmin();

    expect(result.checklistItems.length).toBeGreaterThan(0);
    expect(result.retentionPolicies.length).toBeGreaterThan(0);
    expect(result.dsrQueue.length).toBeGreaterThan(0);
    expect(result.breachCases.length).toBeGreaterThan(0);
    expect(result.subprocessors.length).toBeGreaterThan(0);
  });

  it("normalizuje data z databáze", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      compliance_checklist_items: [
        {
          id: "item-1",
          area: "Test",
          title: "Checklist položka",
          description: "Popis",
          status: "implemented",
          priority: "P1",
        },
      ],
      compliance_retention_policies: [
        {
          id: "retention-1",
          category: "Kontakty",
          purpose: "CRM",
          retention_days: 30,
          status: "partial",
        },
      ],
      data_subject_requests: [
        {
          id: "dsr-1",
          request_type: "export",
          subject_label: "Export subjektu",
          status: "completed",
          due_at: "2026-03-30",
        },
      ],
      breach_cases: [
        {
          id: "breach-1",
          title: "Breach",
          status: "assessment",
          risk_level: "high",
          linked_incident_id: "INC-1",
        },
      ],
      subprocessors: [
        {
          id: "sub-1",
          name: "Supabase",
          region: "EU",
          purpose: "Hosting",
          transfer_mechanism: "SCC",
        },
      ],
    };

    state.from.mockImplementation((table: string) => {
      let orderCalls = 0;
      const query = {
        select: vi.fn(),
        order: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.order.mockImplementation(() => {
        orderCalls += 1;
        if (table === "compliance_checklist_items" && orderCalls === 1) {
          return query;
        }
        return Promise.resolve({
          data: rowsByTable[table] ?? [],
          error: null,
        });
      });
      return query;
    });

    const { getComplianceOverviewAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await getComplianceOverviewAdmin();

    expect(result.checklistItems[0]).toMatchObject({
      id: "item-1",
      status: "implemented",
      priority: "P1",
    });
    expect(result.retentionPolicies[0]).toMatchObject({
      category: "Kontakty",
      retentionDays: 30,
    });
    expect(result.dsrQueue[0]).toMatchObject({
      requestType: "export",
      status: "completed",
    });
    expect(result.breachCases[0]).toMatchObject({
      status: "assessment",
      riskLevel: "high",
      linkedIncidentId: "INC-1",
    });
    expect(result.subprocessors[0]).toMatchObject({
      name: "Supabase",
      region: "EU",
    });
  });

  it("umí vytvořit DSR požadavek a audit záznam", async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    state.from.mockImplementation(() => ({
      insert: insertMock,
    }));

    const { createDataSubjectRequestAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await createDataSubjectRequestAdmin({
      id: "DSR-1",
      requestType: "export",
      subjectLabel: "Export kontaktu",
      dueAt: "2026-03-19",
      actor: "martin",
    });

    expect(insertMock).toHaveBeenNthCalledWith(1, {
      id: "DSR-1",
      request_type: "export",
      subject_label: "Export kontaktu",
      status: "new",
      due_at: "2026-03-19",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      actor: "martin",
      action: "create_dsr_request",
      target_type: "data_subject_request",
      target_id: "DSR-1",
      summary: "Vytvořen DSR request export pro Export kontaktu",
    });
  });

  it("umí změnit stav breach case a zapsat audit", async () => {
    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "breach_cases") return updateQuery;
      return { insert: insertMock };
    });

    const { updateBreachCaseStatusAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await updateBreachCaseStatusAdmin({
      id: "BREACH-1",
      status: "reported",
      actor: "martin",
    });

    expect(updateQuery.update).toHaveBeenCalledTimes(1);
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BREACH-1");
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "update_breach_status",
      target_type: "breach_case",
      target_id: "BREACH-1",
      summary: "Breach case BREACH-1 změněn na stav reported",
    });
  });

  it("umí vyvolat DSR export přes RPC a audit", async () => {
    state.rpc.mockResolvedValue({
      data: {
        query: "Jan Novak",
        generated_at: "2026-03-12T10:00:00.000Z",
        user_profiles: [],
        subcontractors: [],
        projects: [],
      },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation(() => ({ insert: insertMock }));

    const { exportDataSubjectAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await exportDataSubjectAdmin({
      query: "Jan Novak",
      actor: "martin",
    });

    expect(state.rpc).toHaveBeenCalledWith("get_data_subject_export_admin", {
      subject_query: "Jan Novak",
    });
    expect(result.query).toBe("Jan Novak");
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "export_dsr_data",
      target_type: "data_subject",
      target_id: "Jan Novak",
      summary: "Vygenerován export osobních údajů pro dotaz Jan Novak",
    });
  });

  it("umí vyvolat anonymizaci přes RPC a audit", async () => {
    state.rpc.mockResolvedValue({
      data: {
        query: "Jan Novak",
        anonymized_user_profiles: 1,
        anonymized_subcontractors: 2,
        anonymized_projects: 0,
        completed_at: "2026-03-12T10:00:00.000Z",
      },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation(() => ({ insert: insertMock }));

    const { anonymizeDataSubjectAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await anonymizeDataSubjectAdmin({
      query: "Jan Novak",
      actor: "martin",
    });

    expect(state.rpc).toHaveBeenCalledWith("anonymize_data_subject_admin", {
      subject_query: "Jan Novak",
    });
    expect(result.anonymized_subcontractors).toBe(2);
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "anonymize_dsr_data",
      target_type: "data_subject",
      target_id: "Jan Novak",
      summary: "Spuštěna anonymizace osobních údajů pro dotaz Jan Novak",
    });
  });

  it("umí uložit retention policy a zapsat audit", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "compliance_retention_policies") {
        return { upsert: upsertMock };
      }
      return { insert: insertMock };
    });

    const { saveComplianceRetentionPolicyAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveComplianceRetentionPolicyAdmin({
      id: "admin-audit-events",
      category: "Admin audit events",
      purpose: "Audit",
      retentionDays: 120,
      status: "implemented",
      actor: "martin",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "save_retention_policy",
      target_type: "retention_policy",
      target_id: "admin-audit-events",
      summary: "Uložena retention policy admin-audit-events na 120 dní",
    });
  });

  it("umí spustit retention purge přes RPC", async () => {
    state.rpc.mockResolvedValue({
      data: {
        admin_audit_deleted: 2,
        dsr_events_deleted: 1,
        breach_events_deleted: 3,
        completed_at: "2026-03-12T10:00:00.000Z",
      },
      error: null,
    });

    const { runComplianceRetentionPurgeAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await runComplianceRetentionPurgeAdmin();

    expect(state.rpc).toHaveBeenCalledWith("run_compliance_retention_purge_admin");
    expect(result.breach_events_deleted).toBe(3);
  });

  it("umí uložit subprocessor a zapsat audit", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "subprocessors") {
        return { upsert: upsertMock };
      }
      return { insert: insertMock };
    });

    const { saveSubprocessorAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveSubprocessorAdmin({
      id: "sub-2",
      name: "OpenAI",
      region: "US",
      purpose: "AI processing",
      transferMechanism: "SCC",
      actor: "martin",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "save_subprocessor",
      target_type: "subprocessor",
      target_id: "sub-2",
      summary: "Uložen subprocessor OpenAI (US)",
    });
  });
});

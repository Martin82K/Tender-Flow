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
    state.rpc.mockResolvedValue({ data: null, error: new Error("fail") });

    const { getComplianceOverviewAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await getComplianceOverviewAdmin();

    expect(result.checklistItems.length).toBeGreaterThan(0);
    expect(result.retentionPolicies.length).toBeGreaterThan(0);
    expect(result.dsrQueue.length).toBeGreaterThan(0);
    expect(result.breachCases.length).toBeGreaterThan(0);
    expect(result.breachCaseEvents.length).toBeGreaterThan(0);
    expect(result.subprocessors.length).toBeGreaterThan(0);
    expect(result.processingActivities.length).toBeGreaterThan(0);
    expect(result.crmRetentionReviews.length).toBeGreaterThan(0);
    expect(result.accessReviewUsers).toEqual([]);
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
          requester_label: "Jan Novak",
          intake_channel: "email",
          verification_status: "verified",
          resolution_summary: "Export je připraven k bezpečnému předání.",
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
          assessment_summary: "Probíhá posouzení.",
          affected_data_categories: ["jméno", "e-mail"],
          affected_subject_types: ["kontaktní osoby", "zákazníci"],
          estimated_subject_count: 14,
          notification_rationale:
            "Riziko neoprávněného přístupu je pravděpodobné, proto je připravené hlášení.",
          authority_notified_at: "2026-03-12T12:00:00.000Z",
          data_subjects_notified_at: null,
          created_at: "2026-03-12T09:00:00.000Z",
        },
      ],
      breach_case_events: [
        {
          id: "bre-evt-1",
          breach_case_id: "breach-1",
          event_type: "created",
          summary: "Případ založen",
          actor: "admin",
          created_at: "2026-03-12T09:15:00.000Z",
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
      processing_activities: [
        {
          id: "ropa-1",
          activity_name: "Správa kontaktů",
          purpose: "CRM agenda",
          legal_basis: "plnění smlouvy",
          data_categories: ["jméno", "e-mail"],
          retention_policy_id: "retention-1",
        },
      ],
      processing_activity_subprocessors: [
        {
          processing_activity_id: "ropa-1",
          subprocessor_id: "sub-1",
        },
      ],
      compliance_crm_retention_reviews: [
        {
          id: "crm-ret-1",
          domain_key: "projects",
          domain_label: "Projekty",
          retention_policy_id: "retention-1",
          review_status: "planned",
          manual_workflow_summary: "Ruční review po uzavření projektu.",
          next_review_at: "2026-04-01",
        },
      ],
    };

    state.rpc.mockResolvedValue({
      data: {
        users: [
          {
            user_id: "user-1",
            email: "admin@example.com",
            display_name: "Admin User",
            app_role_id: "priprava",
            app_role_label: "Přípravář",
            org_roles: ["owner"],
            last_sign_in: "2026-03-01T10:00:00.000Z",
            risk_flags: ["privileged_access"],
          },
        ],
        audit_entries: [
          {
            id: "audit-1",
            event_type: "user_role_changed",
            actor_email: "boss@example.com",
            target_user_email: "admin@example.com",
            target_role_id: "priprava",
            permission_key: null,
            old_value: "member",
            new_value: "priprava",
            summary: "Role změněna",
            created_at: "2026-03-12T11:00:00.000Z",
          },
        ],
        review_reports: [
          {
            id: "review-1",
            review_scope: "all_admin_access",
            summary: "Měsíční review",
            reviewed_by_email: "boss@example.com",
            total_users: 12,
            admin_users: 3,
            stale_users: 1,
            created_at: "2026-03-12T12:00:00.000Z",
          },
        ],
      },
      error: null,
    });

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
      requesterLabel: "Jan Novak",
      intakeChannel: "email",
      verificationStatus: "verified",
      resolutionSummary: "Export je připraven k bezpečnému předání.",
      status: "completed",
    });
    expect(result.breachCases[0]).toMatchObject({
      status: "assessment",
      riskLevel: "high",
      linkedIncidentId: "INC-1",
      assessmentSummary: "Probíhá posouzení.",
      affectedDataCategories: ["jméno", "e-mail"],
      affectedSubjectTypes: ["kontaktní osoby", "zákazníci"],
      estimatedSubjectCount: 14,
      notificationRationale:
        "Riziko neoprávněného přístupu je pravděpodobné, proto je připravené hlášení.",
      authorityNotifiedAt: "2026-03-12T12:00:00.000Z",
    });
    expect(result.breachCaseEvents[0]).toMatchObject({
      breachCaseId: "breach-1",
      eventType: "created",
    });
    expect(result.subprocessors[0]).toMatchObject({
      name: "Supabase",
      region: "EU",
    });
    expect(result.crmRetentionReviews[0]).toMatchObject({
      domainKey: "projects",
      domainLabel: "Projekty",
      retentionPolicyId: "retention-1",
      reviewStatus: "planned",
    });
    expect(result.processingActivities[0]).toMatchObject({
      activityName: "Správa kontaktů",
      legalBasis: "plnění smlouvy",
      retentionPolicyId: "retention-1",
      linkedSubprocessorIds: ["sub-1"],
    });
    expect(result.accessReviewUsers[0]).toMatchObject({
      email: "admin@example.com",
      appRoleId: "priprava",
    });
    expect(result.accessAuditEntries[0]).toMatchObject({
      eventType: "user_role_changed",
      actorEmail: "boss@example.com",
    });
    expect(result.accessReviewReports[0]).toMatchObject({
      summary: "Měsíční review",
      adminUsers: 3,
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
      requesterLabel: "Jan Novak",
      intakeChannel: "email",
      verificationStatus: "verified",
      resolutionSummary: "Prijat e-mailem, identita overena.",
      dueAt: "2026-03-19",
      actor: "martin",
    });

    expect(insertMock).toHaveBeenNthCalledWith(1, {
      id: "DSR-1",
      request_type: "export",
      subject_label: "Export kontaktu",
      requester_label: "Jan Novak",
      intake_channel: "email",
      verification_status: "verified",
      resolution_summary: "Prijat e-mailem, identita overena.",
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

  it("umí uložit evidenci vyřízení DSR a zapsat audit", async () => {
    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "data_subject_requests") return updateQuery;
      return { insert: insertMock };
    });

    const { saveDataSubjectRequestHandlingAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveDataSubjectRequestHandlingAdmin({
      id: "DSR-1",
      requesterLabel: "Jan Novak",
      intakeChannel: "support",
      verificationStatus: "verified",
      resolutionSummary: "Export pripraven a predan bezpecnym kanalem.",
      actor: "martin",
    });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        requester_label: "Jan Novak",
        intake_channel: "support",
        verification_status: "verified",
        resolution_summary: "Export pripraven a predan bezpecnym kanalem.",
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "DSR-1");
    expect(insertMock).toHaveBeenNthCalledWith(1, {
      actor: "martin",
      action: "save_dsr_handling",
      target_type: "data_subject_request",
      target_id: "DSR-1",
      summary: "Doplněna evidence vyřízení DSR requestu DSR-1",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      request_id: "DSR-1",
      event_type: "handling_saved",
      summary: "Kanál: support • Ověření: verified • Žadatel: Jan Novak",
      actor: "martin",
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

  it("umí uložit breach posouzení a timeline event", async () => {
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

    const { saveBreachAssessmentAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveBreachAssessmentAdmin({
      id: "BREACH-1",
      assessmentSummary: "Rozsah potvrzen a běží containment.",
      actor: "martin",
    });

    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BREACH-1");
    expect(insertMock).toHaveBeenNthCalledWith(1, {
      actor: "martin",
      action: "save_breach_assessment",
      target_type: "breach_case",
      target_id: "BREACH-1",
      summary: "Uloženo posouzení breach case BREACH-1",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      breach_case_id: "BREACH-1",
      event_type: "assessment_saved",
      summary: "Rozsah potvrzen a běží containment.",
      actor: "martin",
    });
  });

  it("umí uložit breach klasifikaci a timeline event", async () => {
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

    const { saveBreachClassificationAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveBreachClassificationAdmin({
      id: "BREACH-1",
      affectedDataCategories: ["jméno", "e-mail", "telefon"],
      affectedSubjectTypes: ["zákazníci", "kontaktní osoby"],
      estimatedSubjectCount: 25,
      notificationRationale:
        "Riziko neoprávněného přístupu je pravděpodobné a vyžaduje právní rozhodnutí.",
      actor: "martin",
    });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_data_categories: ["jméno", "e-mail", "telefon"],
        affected_subject_types: ["zákazníci", "kontaktní osoby"],
        estimated_subject_count: 25,
        notification_rationale:
          "Riziko neoprávněného přístupu je pravděpodobné a vyžaduje právní rozhodnutí.",
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BREACH-1");
    expect(insertMock).toHaveBeenNthCalledWith(1, {
      actor: "martin",
      action: "save_breach_classification",
      target_type: "breach_case",
      target_id: "BREACH-1",
      summary: "Uložena klasifikace breach case BREACH-1",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      breach_case_id: "BREACH-1",
      event_type: "classification_saved",
      summary:
        "Kategorie dat: jméno, e-mail, telefon • Subjekty: zákazníci, kontaktní osoby • Odhad: 25",
      actor: "martin",
    });
  });

  it("umí přidat timeline event breach případu", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation(() => ({ insert: insertMock }));

    const { addBreachCaseTimelineEventAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await addBreachCaseTimelineEventAdmin({
      breachCaseId: "BREACH-1",
      summary: "Interní eskalace dokončena.",
      actor: "martin",
    });

    expect(insertMock).toHaveBeenNthCalledWith(1, {
      actor: "martin",
      action: "add_breach_timeline_event",
      target_type: "breach_case",
      target_id: "BREACH-1",
      summary: "Doplněn timeline krok pro breach case BREACH-1",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      breach_case_id: "BREACH-1",
      event_type: "note",
      summary: "Interní eskalace dokončena.",
      actor: "martin",
    });
  });

  it("umí zapsat notifikaci úřadu nebo subjektů", async () => {
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

    const { markBreachNotificationAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await markBreachNotificationAdmin({
      id: "BREACH-1",
      target: "authority",
      actor: "martin",
    });

    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BREACH-1");
    expect(insertMock).toHaveBeenNthCalledWith(1, {
      actor: "martin",
      action: "mark_breach_authority_notification",
      target_type: "breach_case",
      target_id: "BREACH-1",
      summary: "Zapsáno hlášení ÚOOÚ pro breach case BREACH-1",
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      breach_case_id: "BREACH-1",
      event_type: "authority_notified",
      summary: "Zapsáno hlášení ÚOOÚ",
      actor: "martin",
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
        notifications_deleted: 4,
        password_reset_tokens_deleted: 5,
        feature_usage_deleted: 6,
        ai_agent_usage_deleted: 7,
        ai_voice_usage_deleted: 8,
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
    expect(result.notifications_deleted).toBe(4);
    expect(result.password_reset_tokens_deleted).toBe(5);
    expect(result.feature_usage_deleted).toBe(6);
    expect(result.ai_agent_usage_deleted).toBe(7);
    expect(result.ai_voice_usage_deleted).toBe(8);
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

  it("umí uložit činnost zpracování a zapsat audit", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const linkUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "processing_activities") {
        return { upsert: upsertMock };
      }
      if (table === "processing_activity_subprocessors") {
        return { upsert: linkUpsertMock };
      }
      return { insert: insertMock };
    });

    const { saveProcessingActivityAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveProcessingActivityAdmin({
      id: "ropa-1",
      activityName: "Správa kontaktů",
      purpose: "CRM agenda",
      legalBasis: "plnění smlouvy",
      dataCategories: ["jméno", "e-mail"],
      retentionPolicyId: "retention-1",
      linkedSubprocessorIds: ["sub-1"],
      actor: "martin",
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ropa-1",
        activity_name: "Správa kontaktů",
        purpose: "CRM agenda",
        legal_basis: "plnění smlouvy",
        data_categories: ["jméno", "e-mail"],
        retention_policy_id: "retention-1",
      }),
      { onConflict: "id" },
    );
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "save_processing_activity",
      target_type: "processing_activity",
      target_id: "ropa-1",
      summary: "Uložena činnost zpracování Správa kontaktů",
    });
    expect(linkUpsertMock).toHaveBeenCalledWith(
      [
        {
          processing_activity_id: "ropa-1",
          subprocessor_id: "sub-1",
        },
      ],
      { onConflict: "processing_activity_id,subprocessor_id" },
    );
  });

  it("umí uložit access review report a zapsat audit", async () => {
    state.rpc.mockResolvedValue({
      data: "review-2",
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    state.from.mockImplementation(() => ({ insert: insertMock }));

    const { createAccessReviewReportAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = await createAccessReviewReportAdmin({
      summary: "Kontrola admin přístupů",
      actor: "martin",
    });

    expect(state.rpc).toHaveBeenCalledWith("create_access_review_report_admin", {
      review_scope_input: "all_admin_access",
      summary_input: "Kontrola admin přístupů",
    });
    expect(result).toBe("review-2");
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "create_access_review_report",
      target_type: "access_review",
      target_id: "review-2",
      summary: "Vytvořen access review report: Kontrola admin přístupů",
    });
  });

  it("umí uložit CRM retention review plán a zapsat audit", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    state.from.mockImplementation((table: string) => {
      if (table === "compliance_crm_retention_reviews") {
        return { upsert: upsertMock };
      }
      return { insert: insertMock };
    });

    const { saveCrmRetentionReviewAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await saveCrmRetentionReviewAdmin({
      id: "crm-ret-1",
      domainKey: "projects",
      domainLabel: "Projekty",
      retentionPolicyId: "contacts-projects",
      reviewStatus: "planned",
      manualWorkflowSummary: "Ruční review po uzavření projektu.",
      nextReviewAt: "2026-04-01",
      actor: "martin",
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "crm-ret-1",
        domain_key: "projects",
        domain_label: "Projekty",
        retention_policy_id: "contacts-projects",
        review_status: "planned",
        manual_workflow_summary: "Ruční review po uzavření projektu.",
        next_review_at: "2026-04-01",
      }),
      { onConflict: "id" },
    );
    expect(insertMock).toHaveBeenCalledWith({
      actor: "martin",
      action: "save_crm_retention_review",
      target_type: "crm_retention_review",
      target_id: "crm-ret-1",
      summary: "Uložen retenční review plán pro Projekty",
    });
  });

  it("umí sestavit export podkladů pro ÚOOÚ z breach případu", async () => {
    const { buildBreachAuthorityReportAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    const result = buildBreachAuthorityReportAdmin({
      breachCase: {
        id: "BREACH-1",
        title: "Podezření na neoprávněný export",
        status: "assessment",
        riskLevel: "high",
        linkedIncidentId: "INC-1",
        assessmentSummary: "Probíhá právní posouzení a containment.",
        affectedDataCategories: ["jméno", "e-mail"],
        affectedSubjectTypes: ["kontaktní osoby"],
        estimatedSubjectCount: 12,
        notificationRationale:
          "Existuje pravděpodobné riziko pro dotčené osoby, proto je připravené hlášení.",
        authorityNotifiedAt: null,
        dataSubjectsNotifiedAt: null,
        createdAt: "2026-03-12T09:00:00.000Z",
      },
      events: [
        {
          id: "evt-1",
          breachCaseId: "BREACH-1",
          eventType: "created",
          summary: "Případ založen.",
          actor: "admin",
          createdAt: "2026-03-12T09:10:00.000Z",
        },
      ],
    });

    expect(result.fileName).toBe("uoou_podklady_BREACH-1.md");
    expect(result.content).toContain("# Podklady pro ÚOOÚ");
    expect(result.content).toContain("ID případu: BREACH-1");
    expect(result.content).toContain("## Klasifikace");
    expect(result.content).toContain("Dotčené kategorie údajů: jméno, e-mail");
    expect(result.content).toContain("Dotčené subjekty: kontaktní osoby");
    expect(result.content).toContain("Odhad počtu subjektů: 12");
    expect(result.content).toContain(
      "Důvod hlášení / nehlášení: Existuje pravděpodobné riziko pro dotčené osoby, proto je připravené hlášení.",
    );
    expect(result.content).toContain("Probíhá právní posouzení a containment.");
    expect(result.content).toContain("Případ založen.");
  });
});

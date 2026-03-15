import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const query = {
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
  };

  query.insert.mockResolvedValue({ error: null });
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue({ error: null });

  return {
    from: vi.fn(() => query),
    rpc: vi.fn(),
    rpcRest: vi.fn(),
    query,
  };
});

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: state.from,
    rpc: state.rpc,
    rpcRest: state.rpcRest,
  },
}));

describe("compliance incident -> breach workflow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.query.insert.mockResolvedValue({ error: null });
    state.query.update.mockReturnValue(state.query);
    state.query.eq.mockResolvedValue({ error: null });
  });

  it("z runtime incidentu založí breach case, uloží posouzení a přidá timeline krok", async () => {
    const { createBreachCaseFromIncidentAdmin } = await import(
      "@/features/settings/api/complianceAdminService"
    );

    await createBreachCaseFromIncidentAdmin({
      breachCaseId: "BREACH-INC-1",
      actor: "security-admin",
      incident: {
        id: "row-1",
        incident_id: "INC-1",
        occurred_at: "2026-03-15T09:00:00.000Z",
        ingested_at: "2026-03-15T09:00:05.000Z",
        severity: "error",
        source: "renderer",
        category: "auth",
        code: "AUTH_REFRESH_FAILED",
        message: "Refresh token flow failed repeatedly.",
        stack: null,
        fingerprint: "fp-1",
        app_version: "1.4.1",
        release_channel: "stable",
        platform: "web",
        os: "macOS",
        route: "/app/settings",
        session_id: "SID-1",
        user_id: "user-1",
        user_email: "admin@example.com",
        organization_id: "org-1",
        context: {},
      },
    });

    const insertCalls = state.query.insert.mock.calls;
    const breachInsert = insertCalls.find(([payload]) => payload?.id === "BREACH-INC-1");
    const assessmentAudit = insertCalls.find(
      ([payload]) =>
        payload?.action === "save_breach_assessment" && payload?.target_id === "BREACH-INC-1",
    );
    const timelineEvent = insertCalls.find(
      ([payload]) =>
        payload?.breach_case_id === "BREACH-INC-1" &&
        String(payload?.summary || "").includes("runtime incidentu INC-1"),
    );

    expect(breachInsert?.[0]).toMatchObject({
      id: "BREACH-INC-1",
      linked_incident_id: "INC-1",
      risk_level: "high",
    });
    expect(state.query.update).toHaveBeenCalled();
    expect(state.query.eq).toHaveBeenCalledWith("id", "BREACH-INC-1");
    expect(assessmentAudit?.[0]).toMatchObject({
      action: "save_breach_assessment",
      target_type: "breach_case",
      target_id: "BREACH-INC-1",
    });
    expect(timelineEvent?.[0]).toMatchObject({
      breach_case_id: "BREACH-INC-1",
      event_type: "note",
      actor: "security-admin",
    });
  });
});

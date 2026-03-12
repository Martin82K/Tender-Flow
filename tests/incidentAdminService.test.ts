import { beforeEach, describe, expect, it, vi } from "vitest";

describe("incidentAdminService", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("načte incidenty přes admin RPC s filtrem", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "row-1", incident_id: "INC-1" }],
      error: null,
    });

    vi.doMock("../services/supabase", () => ({
      supabase: { rpc },
    }));

    const { getAppIncidentsAdmin } = await import("../services/incidentAdminService");
    const rows = await getAppIncidentsAdmin({
      incidentId: "INC-1",
      userId: "user-1",
      userEmail: "uzivatel@example.com",
      actionOrCode: "create_folder",
      fromTs: "2026-02-01T00:00:00.000Z",
      toTs: "2026-02-02T00:00:00.000Z",
      limit: 42,
    });

    expect(rpc).toHaveBeenCalledWith("get_app_incidents_admin", {
      incident_id_filter: "INC-1",
      user_id_filter: "user-1",
      email_filter: "uzivatel@example.com",
      action_or_code_filter: "create_folder",
      from_ts: "2026-02-01T00:00:00.000Z",
      to_ts: "2026-02-02T00:00:00.000Z",
      max_rows: 42,
    });
    expect(rows).toEqual([{ id: "row-1", incident_id: "INC-1" }]);
  });

  it("purge volá admin RPC se sanitizovaným počtem dnů", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 17,
      error: null,
    });

    vi.doMock("../services/supabase", () => ({
      supabase: { rpc },
    }));

    const { purgeOldAppIncidentsAdmin } = await import("../services/incidentAdminService");
    const deleted = await purgeOldAppIncidentsAdmin(2);

    expect(rpc).toHaveBeenCalledWith("purge_old_app_incident_events_admin", {
      days_to_keep: 7,
    });
    expect(deleted).toBe(17);
  });

  it("při staré RPC signatuře spadne zpět na legacy dotaz", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          status: 404,
          code: "PGRST202",
          message: "Could not find the function public.get_app_incidents_admin",
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: "row-legacy", incident_id: "INC-OLD", user_id: "user-1" }],
        error: null,
      });

    vi.doMock("../services/supabase", () => ({
      supabase: { rpc },
    }));

    const { getAppIncidentsAdmin } = await import("../services/incidentAdminService");
    const rows = await getAppIncidentsAdmin({
      incidentId: "INC-OLD",
      userEmail: "legacy@example.com",
      actionOrCode: "create_folder",
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "get_app_incidents_admin", {
      incident_id_filter: "INC-OLD",
      user_id_filter: null,
      email_filter: "legacy@example.com",
      action_or_code_filter: "create_folder",
      from_ts: null,
      to_ts: null,
      max_rows: 200,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_app_incidents_admin", {
      incident_id_filter: "INC-OLD",
      user_id_filter: null,
      from_ts: null,
      to_ts: null,
      max_rows: 200,
    });
    expect(rows).toEqual([
      { id: "row-legacy", incident_id: "INC-OLD", user_id: "user-1", user_email: null },
    ]);
  });
});

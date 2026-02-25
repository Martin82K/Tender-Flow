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
      fromTs: "2026-02-01T00:00:00.000Z",
      toTs: "2026-02-02T00:00:00.000Z",
      limit: 42,
    });

    expect(rpc).toHaveBeenCalledWith("get_app_incidents_admin", {
      incident_id_filter: "INC-1",
      user_id_filter: "user-1",
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
});


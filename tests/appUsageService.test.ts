import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAppUsageSummaryAdmin,
  recordUsageAction,
  recordUsageHeartbeat,
} from "../services/appUsageService";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
  },
}));

describe("appUsageService", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
  });

  it("recordUsageHeartbeat volá agregované RPC s ořezaným intervalem", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(recordUsageHeartbeat("session-1", 999)).resolves.toBe(true);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("record_usage_heartbeat", {
      session_id_input: "session-1",
      active_seconds_input: 300,
    });
  });

  it("recordUsageAction ořezává záporné a příliš velké hodnoty", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      recordUsageAction({
        actionCount: -1,
        createdRecordsCount: 20_000,
        updatedRecordsCount: 5,
        deletedRecordsCount: 2,
        uploadedBytes: 99_999_999_999,
      }),
    ).resolves.toBe(true);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("record_usage_action", {
      action_count_input: 0,
      created_records_count_input: 10000,
      updated_records_count_input: 5,
      deleted_records_count_input: 2,
      uploaded_bytes_input: 10_737_418_240,
    });
  });

  it("recordUsageAction používá výchozí actionCount pro běžnou akci", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(recordUsageAction({ updatedRecordsCount: 1 })).resolves.toBe(true);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("record_usage_action", {
      action_count_input: 1,
      created_records_count_input: 0,
      updated_records_count_input: 1,
      deleted_records_count_input: 0,
      uploaded_bytes_input: 0,
    });
  });

  it("getAppUsageSummaryAdmin normalizuje agregovaný payload", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          organization_id: "org-1",
          organization_name: "Tenant A",
          user_id: "user-1",
          email: "a@example.test",
          display_name: "Anna",
          active_seconds: "3600",
          active_days: "3",
          session_count: "4",
          action_count: 12,
          uploaded_bytes: "1048576",
          created_records_count: "5",
          updated_records_count: 7,
          deleted_records_count: 1,
          last_seen_at: "2026-05-18T10:00:00.000Z",
          daily_stats: [
            {
              date: "2026-05-18",
              activeSeconds: "120",
              sessionCount: 1,
              actionCount: 2,
              uploadedBytes: "64",
              createdRecordsCount: 1,
              updatedRecordsCount: 1,
              deletedRecordsCount: 0,
            },
          ],
        },
      ],
      error: null,
    });

    await expect(getAppUsageSummaryAdmin(30)).resolves.toEqual([
      {
        organizationId: "org-1",
        organizationName: "Tenant A",
        userId: "user-1",
        email: "a@example.test",
        displayName: "Anna",
        activeSeconds: 3600,
        activeDays: 3,
        sessionCount: 4,
        actionCount: 12,
        uploadedBytes: 1048576,
        createdRecordsCount: 5,
        updatedRecordsCount: 7,
        deletedRecordsCount: 1,
        lastSeenAt: "2026-05-18T10:00:00.000Z",
        dailyStats: [
          {
            date: "2026-05-18",
            activeSeconds: 120,
            sessionCount: 1,
            actionCount: 2,
            uploadedBytes: 64,
            createdRecordsCount: 1,
            updatedRecordsCount: 1,
            deletedRecordsCount: 0,
          },
        ],
      },
    ]);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_app_usage_summary_admin", {
      days_back: 30,
      target_organization_id: null,
    });
  });
});

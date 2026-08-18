import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppUsageAdmin } from "@/features/settings/AppUsageAdmin";

const usageMocks = vi.hoisted(() => ({
  getAppUsageSummaryAdmin: vi.fn(),
  showAlert: vi.fn(),
}));

vi.mock("@/features/settings/api", () => ({
  getAppUsageSummaryAdmin: usageMocks.getAppUsageSummaryAdmin,
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({ showAlert: usageMocks.showAlert }),
}));

const usageItem = (overrides: Record<string, unknown>) => ({
  organizationId: "org-1",
  organizationName: "Baustav",
  userId: "user-1",
  email: "active@example.test",
  displayName: "Aktivní uživatel",
  activeSeconds: 3600,
  activeDays: 2,
  sessionCount: 3,
  actionCount: 4,
  uploadedBytes: 0,
  createdRecordsCount: 0,
  updatedRecordsCount: 1,
  deletedRecordsCount: 0,
  hasMeasuredUsage: true,
  lastSeenAt: "2026-08-18T18:00:00.000Z",
  dailyStats: [],
  ...overrides,
});

describe("AppUsageAdmin", () => {
  beforeEach(() => {
    usageMocks.getAppUsageSummaryAdmin.mockReset();
    usageMocks.showAlert.mockReset();
  });

  it("nezamění provozně aktivního uživatele bez historického měření za nulovou aktivitu", async () => {
    usageMocks.getAppUsageSummaryAdmin.mockResolvedValue([
      usageItem({}),
      usageItem({
        userId: "user-2",
        email: "inactive@example.test",
        displayName: "Aktivní bez měření",
        activeSeconds: 0,
        activeDays: 0,
        sessionCount: 0,
        actionCount: 0,
        updatedRecordsCount: 0,
        hasMeasuredUsage: false,
        lastSeenAt: "2026-08-18T17:00:00.000Z",
      }),
    ]);

    render(<AppUsageAdmin />);
    fireEvent.click(screen.getByRole("button", { name: /načíst statistiky/i }));

    expect(await screen.findByText("Aktivní bez měření")).toBeInTheDocument();
    expect(screen.getByText("2 z 2")).toBeInTheDocument();
    expect(screen.getAllByText("Neměřeno").length).toBeGreaterThan(0);
    await waitFor(() => expect(usageMocks.getAppUsageSummaryAdmin).toHaveBeenCalledWith(30));
  });

  it("databázový přehled používá autentizační stopu a označí dostupnost měření", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((file) => file.endsWith("_collect_app_usage_for_all_users.sql"));

    expect(migrationName).toBeDefined();
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName || ""),
      "utf8",
    );

    expect(migration).toContain("auth.sessions");
    expect(migration).toContain("user_auth_devices");
    expect(migration).toContain("has_measured_usage");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) FROM PUBLIC, anon");
  });

  it("omezuje provozní agregace na 365 dní a purge nezpřístupní běžným uživatelům", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((file) => file.endsWith("_schedule_app_usage_retention.sql"));

    expect(migrationName).toBeDefined();
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName || ""),
      "utf8",
    );

    expect(migration).toContain("purge-app-usage-stats");
    expect(migration).toContain("'47 3 * * *'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.purge_app_usage_stats_admin() FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.purge_app_usage_stats_admin() TO service_role");
  });

  it("zachová statistiky bývalých členů a nulovou retenci chápe jako vypnutou", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((file) => file.endsWith("_preserve_historical_app_usage.sql"));

    expect(migrationName).toBeDefined();
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName || ""),
      "utf8",
    );

    expect(migration).toContain("historical_members AS");
    expect(migration).toContain("UNION ALL");
    expect(migration).toContain("IF retention_days IS NULL OR retention_days <= 0 THEN");
  });

  it("používá pro období a organizaci sdílený skinovaný výběr", () => {
    render(<AppUsageAdmin />);

    expect(screen.getByRole("combobox", { name: "Období" })).toHaveClass("tf-themed-select-trigger");
    expect(screen.getByRole("combobox", { name: "Organizace" })).toHaveClass("tf-themed-select-trigger");

    const source = readFileSync(
      join(process.cwd(), "features/settings/AppUsageAdmin.tsx"),
      "utf8",
    );
    expect(source).toContain("<ThemedSelect");
    expect(source).not.toContain("<select");
  });

  it("databázový přehled vychází ze všech aktivních členství a nulovou aktivitu doplňuje přes left join", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((file) => file.endsWith("_include_all_active_users_in_app_usage.sql"));

    expect(migrationName).toBeDefined();
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName || ""),
      "utf8",
    );

    expect(migration).toContain("active_members AS");
    expect(migration).toContain("LEFT JOIN aggregated a");
    expect(migration).toContain("COALESCE(a.active_seconds, 0)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) FROM PUBLIC, anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) TO authenticated");
  });
});

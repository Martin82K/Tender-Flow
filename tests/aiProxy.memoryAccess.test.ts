import { describe, expect, it, vi } from "vitest";

import { resolveAuthorizedProjectMemoryContext } from "../supabase/functions/ai-proxy/memoryAccess";

describe("ai-proxy memory access", () => {
  it("odmitne projekt bez pristupu pres RLS", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await resolveAuthorizedProjectMemoryContext(
      { from } as Parameters<typeof resolveAuthorizedProjectMemoryContext>[0],
      "project-foreign",
    );

    expect(result).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
    expect(from).toHaveBeenCalledWith("projects");
    expect(select).toHaveBeenCalledWith("id, organization_id");
    expect(eq).toHaveBeenCalledWith("id", "project-foreign");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("vrati organization_id jen pro autorizovany projekt", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        organization_id: "org-1",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await resolveAuthorizedProjectMemoryContext(
      { from } as Parameters<typeof resolveAuthorizedProjectMemoryContext>[0],
      "  project-1  ",
    );

    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: "org-1",
        projectId: "project-1",
      },
    });
  });

  it("odmitne projekt bez organization_id, aby storage path nevznikla mimo tenant scope", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        organization_id: null,
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await resolveAuthorizedProjectMemoryContext(
      { from } as Parameters<typeof resolveAuthorizedProjectMemoryContext>[0],
      "project-1",
    );

    expect(result).toEqual({
      ok: false,
      error: "PROJECT_ORGANIZATION_MISSING",
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { resolveAuthorizedProjectMemoryContext } from "../supabase/functions/ai-proxy/memoryAccess";

describe("ai-proxy memory access", () => {
  const makeClient = (opts: {
    project:
      | { id: string; owner_id: string | null; organization_id: string | null }
      | null;
    sharePermission: "view" | "edit" | null;
  }) => {
    const calls: Array<{
      table: "projects" | "project_shares";
      permissionFilter?: ("view" | "edit")[];
    }> = [];

    const projectsMaybeSingle = vi.fn(async () => ({
      data: opts.project,
      error: null,
    }));
    const projectSharesIn = vi.fn((column: "permission", values: ("view" | "edit")[]) => {
      expect(column).toBe("permission");
      calls.push({ table: "project_shares", permissionFilter: values });
      const projectSharesMaybeSingle = vi.fn(async () => ({
        data: opts.sharePermission && values.includes(opts.sharePermission)
          ? { permission: opts.sharePermission }
          : null,
        error: null,
      }));
      return { maybeSingle: projectSharesMaybeSingle };
    });
    const projectSharesEqUser = vi.fn((column: "user_id", value: string) => {
      expect(column).toBe("user_id");
      expect(value).toBe("user-1");
      return { in: projectSharesIn };
    });
    const projectSharesEqProject = vi.fn((column: "project_id", value: string) => {
      expect(column).toBe("project_id");
      expect(value).toBe("project-1");
      return { eq: projectSharesEqUser };
    });
    const projectSharesSelect = vi.fn((columns: "permission") => {
      expect(columns).toBe("permission");
      return { eq: projectSharesEqProject };
    });

    const projectsEq = vi.fn((column: "id", value: string) => {
      expect(column).toBe("id");
      expect(value).toBe("project-1");
      calls.push({ table: "projects" });
      return { maybeSingle: projectsMaybeSingle };
    });
    const projectsSelect = vi.fn((columns: "id, owner_id, organization_id") => {
      expect(columns).toBe("id, owner_id, organization_id");
      return { eq: projectsEq };
    });

    const from = vi.fn((table: "projects" | "project_shares") => {
      if (table === "projects") return { select: projectsSelect };
      return { select: projectSharesSelect };
    });

    return {
      client: { from } as Parameters<typeof resolveAuthorizedProjectMemoryContext>[0],
      calls,
      projectsMaybeSingle,
    };
  };

  it("memory-load povoli ownerovi", async () => {
    const { client, calls } = makeClient({
      project: { id: "project-1", owner_id: "user-1", organization_id: "org-1" },
      sharePermission: null,
    });

    const result = await resolveAuthorizedProjectMemoryContext(client, "project-1", "user-1", "view");

    expect(result).toEqual({
      ok: true,
      value: { organizationId: "org-1", projectId: "project-1" },
    });
    expect(calls).toEqual([{ table: "projects" }]);
  });

  it("memory-load povoli shared:view i shared:edit", async () => {
    const view = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: "view",
    });
    const edit = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: "edit",
    });

    const resultView = await resolveAuthorizedProjectMemoryContext(view.client, "project-1", "user-1", "view");
    const resultEdit = await resolveAuthorizedProjectMemoryContext(edit.client, "project-1", "user-1", "view");

    expect(resultView).toEqual({
      ok: true,
      value: { organizationId: "org-1", projectId: "project-1" },
    });
    expect(resultEdit).toEqual({
      ok: true,
      value: { organizationId: "org-1", projectId: "project-1" },
    });
    expect(view.calls).toContainEqual({ table: "project_shares", permissionFilter: ["view", "edit"] });
    expect(edit.calls).toContainEqual({ table: "project_shares", permissionFilter: ["view", "edit"] });
  });

  it("memory-load odmitne no-share a projekt mimo organizaci/bez RLS pristupu", async () => {
    const noShare = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: null,
    });
    const foreign = makeClient({
      project: null,
      sharePermission: null,
    });

    const noShareResult = await resolveAuthorizedProjectMemoryContext(noShare.client, "project-1", "user-1", "view");
    const foreignResult = await resolveAuthorizedProjectMemoryContext(foreign.client, "project-1", "user-1", "view");

    expect(noShareResult).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
    expect(foreignResult).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
  });

  it("memory-save povoli ownerovi a shared:edit", async () => {
    const owner = makeClient({
      project: { id: "project-1", owner_id: "user-1", organization_id: "org-1" },
      sharePermission: null,
    });
    const sharedEdit = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: "edit",
    });

    const ownerResult = await resolveAuthorizedProjectMemoryContext(owner.client, "project-1", "user-1", "edit");
    const sharedEditResult = await resolveAuthorizedProjectMemoryContext(sharedEdit.client, "project-1", "user-1", "edit");

    expect(ownerResult).toEqual({
      ok: true,
      value: { organizationId: "org-1", projectId: "project-1" },
    });
    expect(sharedEditResult).toEqual({
      ok: true,
      value: { organizationId: "org-1", projectId: "project-1" },
    });
    expect(sharedEdit.calls).toContainEqual({ table: "project_shares", permissionFilter: ["edit"] });
  });

  it("memory-save odmitne shared:view, no-share a projekt mimo organizaci/bez RLS pristupu", async () => {
    const sharedView = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: "view",
    });
    const noShare = makeClient({
      project: { id: "project-1", owner_id: "owner-2", organization_id: "org-1" },
      sharePermission: null,
    });
    const foreign = makeClient({
      project: null,
      sharePermission: null,
    });

    const sharedViewResult = await resolveAuthorizedProjectMemoryContext(sharedView.client, "project-1", "user-1", "edit");
    const noShareResult = await resolveAuthorizedProjectMemoryContext(noShare.client, "project-1", "user-1", "edit");
    const foreignResult = await resolveAuthorizedProjectMemoryContext(foreign.client, "project-1", "user-1", "edit");

    expect(sharedViewResult).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
    expect(noShareResult).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
    expect(foreignResult).toEqual({ ok: false, error: "PROJECT_ACCESS_DENIED" });
  });

  it("odmitne projekt bez organization_id, aby storage path nevznikla mimo tenant scope", async () => {
    const { client } = makeClient({
      project: { id: "project-1", owner_id: "user-1", organization_id: null },
      sharePermission: null,
    });

    const result = await resolveAuthorizedProjectMemoryContext(client, "project-1", "user-1", "view");

    expect(result).toEqual({
      ok: false,
      error: "PROJECT_ORGANIZATION_MISSING",
    });
  });
});

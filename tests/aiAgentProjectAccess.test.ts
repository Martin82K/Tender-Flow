import { describe, expect, it } from "vitest";

import { getProjectAccessCheck } from "../supabase/functions/ai-agent/projectAccess";

describe("ai-agent project access checks", () => {
  it("nevyzaduje share check pro ownera", () => {
    expect(getProjectAccessCheck({
      ownerId: "user-1",
      userId: "user-1",
      isDemo: false,
      projectId: "project-1",
    })).toBeNull();
  });

  it("nevyzaduje share check pro demo projekt", () => {
    expect(getProjectAccessCheck({
      ownerId: null,
      userId: "user-2",
      isDemo: true,
      projectId: "demo-project",
    })).toBeNull();
  });

  it("vyzaduje read share check pro cizi nedemo projekt", () => {
    expect(getProjectAccessCheck({
      ownerId: "user-1",
      userId: "user-2",
      isDemo: false,
      projectId: "project-1",
    })).toEqual({
      rpcName: "is_project_shared_with_user",
      rpcArgs: {
        p_id: "project-1",
        u_id: "user-2",
      },
      deniedMessage: "Projekt neni sdilen pro tohoto uzivatele.",
    });
  });

  it("vyzaduje edit share check pro zapis do ciziho projektu", () => {
    expect(getProjectAccessCheck({
      ownerId: null,
      userId: "user-2",
      isDemo: false,
      projectId: "project-1",
      requiredAccess: "edit",
    })).toEqual({
      rpcName: "has_project_share_permission",
      rpcArgs: {
        p_id: "project-1",
        u_id: "user-2",
        required_permission: "edit",
      },
      deniedMessage: "Projekt neni sdilen pro editaci tomuto uzivateli.",
    });
  });
});

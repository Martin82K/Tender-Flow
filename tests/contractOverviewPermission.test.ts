import { describe, expect, it } from "vitest";
import { resolveContractOverviewPermissionState } from "@features/organization/model/contractOverviewPermission";

describe("organization contract overview permission", () => {
  it.each(["owner", "admin"] as const)("grants %s automatic non-editable access", (role) => {
    expect(resolveContractOverviewPermissionState({ role, is_active: true }, false, true)).toEqual({
      checked: true,
      source: "automatic",
      canAssignExplicitly: false,
    });
  });

  it("allows an organization administrator to explicitly grant an active ordinary member", () => {
    expect(resolveContractOverviewPermissionState({ role: "member", is_active: true }, true, true)).toEqual({
      checked: true,
      source: "explicit",
      canAssignExplicitly: true,
    });
  });

  it("does not allow explicit grants to inactive members", () => {
    expect(resolveContractOverviewPermissionState({ role: "member", is_active: false }, false, true).canAssignExplicitly).toBe(false);
  });
});

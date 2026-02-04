import { describe, it, expect } from "vitest";
import {
  formatOrgRequestStatus,
  formatOrgRole,
  getUserLabel,
  getUserSortKey,
  isOrgAdminRole,
  isOrgOwnerRole,
} from "../utils/organizationUtils";

describe("formatOrgRole", () => {
  it("formats known roles", () => {
    expect(formatOrgRole("owner")).toBe("Vlastník");
    expect(formatOrgRole("admin")).toBe("Administrátor");
    expect(formatOrgRole("member")).toBe("Člen");
  });

  it("handles unknown roles", () => {
    expect(formatOrgRole("custom")).toBe("custom");
    expect(formatOrgRole(null)).toBe("Neznámá role");
  });
});

describe("formatOrgRequestStatus", () => {
  it("formats known statuses", () => {
    expect(formatOrgRequestStatus("pending")).toBe("Čeká na schválení");
    expect(formatOrgRequestStatus("approved")).toBe("Schváleno");
    expect(formatOrgRequestStatus("rejected")).toBe("Zamítnuto");
  });

  it("handles unknown statuses", () => {
    expect(formatOrgRequestStatus("custom")).toBe("custom");
    expect(formatOrgRequestStatus(null)).toBe("Bez žádosti");
  });
});

describe("isOrgAdminRole", () => {
  it("detects admin roles", () => {
    expect(isOrgAdminRole("owner")).toBe(true);
    expect(isOrgAdminRole("admin")).toBe(true);
    expect(isOrgAdminRole("member")).toBe(false);
  });
});

describe("isOrgOwnerRole", () => {
  it("detects owner role", () => {
    expect(isOrgOwnerRole("owner")).toBe(true);
    expect(isOrgOwnerRole("admin")).toBe(false);
  });
});

describe("getUserLabel", () => {
  it("prefers display name when available", () => {
    expect(getUserLabel("user@example.com", "Jana Novakova")).toBe("Jana Novakova");
  });

  it("falls back to email when display name is empty", () => {
    expect(getUserLabel("user@example.com", "   ")).toBe("user@example.com");
    expect(getUserLabel("user@example.com", null)).toBe("user@example.com");
  });
});

describe("getUserSortKey", () => {
  it("returns lowercased label", () => {
    expect(getUserSortKey("USER@EXAMPLE.COM", "Jana Novakova")).toBe("jana novakova");
    expect(getUserSortKey("USER@EXAMPLE.COM", null)).toBe("user@example.com");
  });
});

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getRolesWithPermissions: vi.fn(),
  getAllRoles: vi.fn(),
  getPermissionDefinitions: vi.fn(),
  getUniqueDomains: vi.fn(() => []),
  filterUsers: vi.fn((users: unknown[]) => users),
}));

vi.mock("../services/userManagementService", () => ({
  userManagementService: serviceMocks,
}));

vi.mock("../context/UIContext", () => ({
  useUI: () => ({
    showAlert: vi.fn(),
  }),
}));

import { UserManagement } from "../components/UserManagement";

describe("UserManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    serviceMocks.getAllUsers.mockResolvedValue([
      {
        user_id: "user-1",
        email: "user1@example.com",
        display_name: "User One",
        role_id: null,
        role_label: null,
        created_at: "2026-03-20T10:00:00.000Z",
        last_sign_in: null,
        auth_provider: "email",
        login_type: null,
        org_subscription_tier: "starter",
        subscription_tier_override: null,
        effective_subscription_tier: "starter",
      },
    ]);
    serviceMocks.getRolesWithPermissions.mockResolvedValue([]);
    serviceMocks.getAllRoles.mockResolvedValue([]);
    serviceMocks.getPermissionDefinitions.mockResolvedValue([]);
  });

  it("renderuje subscription sloupec a auto tier volbu", async () => {
    render(<UserManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Předplatné")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Auto (starter)")).toBeInTheDocument();
    });
  });
});

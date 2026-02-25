import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentLogsAdmin } from "@/features/settings/IncidentLogsAdmin";

const mockState = vi.hoisted(() => ({
  getAppIncidentsAdmin: vi.fn(),
  purgeOldAppIncidentsAdmin: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock("@/services/incidentAdminService", () => ({
  getAppIncidentsAdmin: mockState.getAppIncidentsAdmin,
  purgeOldAppIncidentsAdmin: mockState.purgeOldAppIncidentsAdmin,
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: mockState.showAlert,
    showConfirm: mockState.showConfirm,
  }),
}));

describe("IncidentLogsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getAppIncidentsAdmin.mockResolvedValue([
      {
        id: "1",
        incident_id: "INC-TEST-1",
        occurred_at: "2026-02-25T10:00:00.000Z",
        ingested_at: "2026-02-25T10:00:01.000Z",
        severity: "warn",
        source: "renderer",
        category: "auth",
        code: "AUTH_SIGNED_OUT_EVENT",
        message: "Signed out unexpectedly",
        stack: "Error: boom\n at line 1",
        fingerprint: "fp_123",
        app_version: "1.4.0",
        release_channel: "production",
        platform: "desktop",
        os: "darwin",
        route: "/login",
        session_id: "SID-1",
        user_id: "user-1",
        organization_id: "org-1",
        context: { operation: "auth.on_auth_state_change", reason: "invalid_refresh_token" },
      },
    ]);
    mockState.purgeOldAppIncidentsAdmin.mockResolvedValue(4);
    mockState.showConfirm.mockResolvedValue(true);
  });

  it("po rozkliknutí záznamu zobrazí detail incidentu", async () => {
    render(<IncidentLogsAdmin />);

    fireEvent.click(screen.getByRole("button", { name: /Vyhledat incidenty/i }));

    expect(await screen.findByText("INC-TEST-1")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Zobrazit detail incidentu INC-TEST-1" }),
    );

    expect(await screen.findByText("Detail incidentu INC-TEST-1")).toBeInTheDocument();
    expect(screen.getByText("Stack trace")).toBeInTheDocument();
    expect(screen.getByText("Kontext (JSON)")).toBeInTheDocument();
  });

  it("umožní smazat staré logy po potvrzení", async () => {
    render(<IncidentLogsAdmin />);

    fireEvent.change(screen.getByLabelText("Smazat logy starší než (dny)"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Smazat staré logy" }));

    await waitFor(() => {
      expect(mockState.showConfirm).toHaveBeenCalledTimes(1);
    });
    expect(mockState.purgeOldAppIncidentsAdmin).toHaveBeenCalledWith(30);
  });
});

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
        user_email: "uzivatel@example.com",
        organization_id: "org-1",
        context: {
          operation: "auth.on_auth_state_change",
          reason: "invalid_refresh_token",
          action: "create_folder",
          provider: "onedrive",
          action_status: "error",
          project_id: "project-1",
          entity_type: "subcontractor",
          entity_id: "sub-1",
          folder_path: "/tmp/source",
          target_path: "/tmp/target",
        },
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
    expect(screen.getAllByText("uzivatel@example.com")).toHaveLength(2);
    expect(screen.getAllByText("create_folder").length).toBeGreaterThanOrEqual(1);
  });

  it("předá e-mail a akci do filtru vyhledání", async () => {
    render(<IncidentLogsAdmin />);

    fireEvent.change(screen.getByPlaceholderText("E-mail uživatele"), {
      target: { value: "uzivatel@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Akce / kód / text"), {
      target: { value: "create_folder" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Vyhledat incidenty/i }));

    await waitFor(() => {
      expect(mockState.getAppIncidentsAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "uzivatel@example.com",
          actionOrCode: "create_folder",
        }),
      );
    });
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

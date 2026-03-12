import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMfaGuard } from "@/features/settings/AdminMfaGuard";

const mockState = vi.hoisted(() => ({
  getAdminMfaStatus: vi.fn(),
  startAdminMfaEnrollment: vi.fn(),
  verifyAdminMfaEnrollment: vi.fn(),
  elevateAdminMfaSession: vi.fn(),
  showAlert: vi.fn(),
}));

vi.mock("@/features/settings/api/adminMfaService", () => ({
  getAdminMfaStatus: mockState.getAdminMfaStatus,
  startAdminMfaEnrollment: mockState.startAdminMfaEnrollment,
  verifyAdminMfaEnrollment: mockState.verifyAdminMfaEnrollment,
  elevateAdminMfaSession: mockState.elevateAdminMfaSession,
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: mockState.showAlert,
  }),
}));

describe("AdminMfaGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propustí obsah pro neadmin uživatele", async () => {
    mockState.getAdminMfaStatus.mockResolvedValue({
      required: false,
      currentLevel: null,
      nextLevel: null,
      verifiedFactors: [],
      unverifiedFactors: [],
      needsEnrollment: false,
      needsVerification: false,
    });

    render(
      <AdminMfaGuard user={{ role: "user", email: "user@example.com" }}>
        <div>Admin obsah</div>
      </AdminMfaGuard>,
    );

    expect(await screen.findByText("Admin obsah")).toBeInTheDocument();
  });

  it("umožní založit a ověřit MFA faktor", async () => {
    mockState.getAdminMfaStatus
      .mockResolvedValueOnce({
        required: true,
        currentLevel: "aal1",
        nextLevel: "aal2",
        verifiedFactors: [],
        unverifiedFactors: [],
        needsEnrollment: true,
        needsVerification: false,
      })
      .mockResolvedValueOnce({
        required: true,
        currentLevel: "aal1",
        nextLevel: "aal2",
        verifiedFactors: [{ id: "factor-1", factorType: "totp", status: "verified", friendlyName: null }],
        unverifiedFactors: [],
        needsEnrollment: false,
        needsVerification: true,
      });
    mockState.startAdminMfaEnrollment.mockResolvedValue({
      factorId: "factor-1",
      qrCodeSvg: "<svg></svg>",
      secret: "SECRET123",
      friendlyName: "Tender Flow Admin TOTP",
    });
    mockState.verifyAdminMfaEnrollment.mockResolvedValue(undefined);

    render(
      <AdminMfaGuard user={{ role: "admin", email: "admin@example.com" }}>
        <div>Admin obsah</div>
      </AdminMfaGuard>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Založit TOTP faktor" }));
    expect(await screen.findByRole("img", { name: "QR kód pro admin MFA" })).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Kód pro aktivaci admin MFA"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aktivovat MFA" }));

    await waitFor(() => {
      expect(mockState.verifyAdminMfaEnrollment).toHaveBeenCalledWith({
        factorId: "factor-1",
        code: "123456",
      });
    });
  });

  it("umožní ověřit admin session do AAL2", async () => {
    mockState.getAdminMfaStatus
      .mockResolvedValueOnce({
        required: true,
        currentLevel: "aal1",
        nextLevel: "aal2",
        verifiedFactors: [{ id: "factor-1", factorType: "totp", status: "verified", friendlyName: null }],
        unverifiedFactors: [],
        needsEnrollment: false,
        needsVerification: true,
      })
      .mockResolvedValueOnce({
        required: true,
        currentLevel: "aal2",
        nextLevel: "aal2",
        verifiedFactors: [{ id: "factor-1", factorType: "totp", status: "verified", friendlyName: null }],
        unverifiedFactors: [],
        needsEnrollment: false,
        needsVerification: false,
      });
    mockState.elevateAdminMfaSession.mockResolvedValue(undefined);

    render(
      <AdminMfaGuard user={{ role: "admin", email: "admin@example.com" }}>
        <div>Admin obsah</div>
      </AdminMfaGuard>,
    );

    fireEvent.change(await screen.findByLabelText("Kód pro ověření admin session"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ověřit admin session" }));

    await waitFor(() => {
      expect(mockState.elevateAdminMfaSession).toHaveBeenCalledWith({
        factorId: "factor-1",
        code: "654321",
      });
    });

    expect(await screen.findByText("Admin obsah")).toBeInTheDocument();
  });

  it("při chybě renderu QR přepne na inline fallback", async () => {
    mockState.getAdminMfaStatus.mockResolvedValue({
      required: true,
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedFactors: [],
      unverifiedFactors: [],
      needsEnrollment: true,
      needsVerification: false,
    });
    mockState.startAdminMfaEnrollment.mockResolvedValue({
      factorId: "factor-1",
      qrCodeSvg: "<svg><rect width='10' height='10'/></svg>",
      secret: "SECRET123",
      friendlyName: "Tender Flow Admin TOTP",
    });

    render(
      <AdminMfaGuard user={{ role: "admin", email: "admin@example.com" }}>
        <div>Admin obsah</div>
      </AdminMfaGuard>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Založit TOTP faktor" }));
    fireEvent.error(await screen.findByRole("img", { name: "QR kód pro admin MFA" }));

    expect(await screen.findByLabelText("QR kód pro admin MFA fallback")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserSecuritySettings } from "@/features/settings/UserSecuritySettings";

const mockState = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listDevices: vi.fn(),
  revokeDevice: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@infra/auth/mfaService", () => ({
  mfaService: {
    getStatus: mockState.getStatus,
    startTotpEnrollment: vi.fn(),
    verifyEnrollment: vi.fn(),
    verifyFactor: vi.fn(),
    unenrollFactor: vi.fn(),
  },
}));

vi.mock("@infra/auth/deviceService", () => ({
  authDeviceService: {
    listDevices: mockState.listDevices,
    revokeDevice: mockState.revokeDevice,
  },
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: mockState.showAlert,
    showConfirm: mockState.showConfirm,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    logout: mockState.logout,
  }),
}));

describe("UserSecuritySettings zařízení", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getStatus.mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal1",
      factors: [],
      verifiedFactors: [],
      unverifiedFactors: [],
      hasVerifiedFactor: false,
      needsVerification: false,
    });
    mockState.listDevices.mockResolvedValue([
      {
        id: "device-current",
        installationId: "installation-1",
        deviceName: "Mac Web",
        clientKind: "web",
        platform: "MacIntel",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
        authSessionId: "session-1",
        firstSeenAt: "2026-05-18T10:00:00Z",
        lastSeenAt: "2026-05-18T12:15:00Z",
        revokedAt: null,
        status: "active",
        isCurrent: true,
      },
    ]);
    mockState.revokeDevice.mockResolvedValue(undefined);
    mockState.showConfirm.mockResolvedValue(true);
    mockState.logout.mockResolvedValue(undefined);
  });

  it("zobrazí evidovaná zařízení se stavem a metadaty", async () => {
    render(<UserSecuritySettings />);

    expect(await screen.findByText("Mac Web")).toBeInTheDocument();
    expect(screen.getByText("Aktuální")).toBeInTheDocument();
    expect(screen.getByText("Aktivní")).toBeInTheDocument();
    expect(screen.getByText("IP: 127.0.0.1")).toBeInTheDocument();
    expect(mockState.listDevices).toHaveBeenCalledTimes(1);
  });

  it("po potvrzení odhlásí aktuální zařízení a spustí logout", async () => {
    render(<UserSecuritySettings />);

    await screen.findByText("Mac Web");
    fireEvent.click(screen.getByRole("button", { name: /Odhlásit/i }));

    await waitFor(() => {
      expect(mockState.revokeDevice).toHaveBeenCalledWith("device-current");
    });
    expect(mockState.showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Odhlásit aktuální zařízení?",
      }),
    );
    expect(mockState.logout).toHaveBeenCalledTimes(1);
  });
});

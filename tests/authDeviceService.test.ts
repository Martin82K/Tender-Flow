import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    rpc: mockState.rpc,
  },
}));

vi.mock("@/services/platformAdapter", () => ({
  isDesktop: false,
  platformAdapter: {
    platform: {
      os: "web",
    },
  },
}));

describe("authDeviceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockState.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("registruje aktuální zařízení přes RPC a používá stabilní installation_id", async () => {
    const { authDeviceService } = await import("@/infra/auth/deviceService");

    await authDeviceService.registerCurrentDevice();
    await authDeviceService.registerCurrentDevice();

    expect(mockState.rpc).toHaveBeenCalledTimes(2);
    const firstArgs = mockState.rpc.mock.calls[0][1];
    const secondArgs = mockState.rpc.mock.calls[1][1];
    expect(mockState.rpc).toHaveBeenCalledWith(
      "upsert_current_auth_device",
      expect.objectContaining({
        p_installation_id: expect.any(String),
        p_device_name: expect.any(String),
        p_client_kind: "web",
      }),
    );
    expect(firstArgs.p_installation_id).toBe(secondArgs.p_installation_id);
  });

  it("mapuje seznam zařízení a označí aktuální instalaci", async () => {
    const { authDeviceService, getCurrentInstallationId } = await import("@/infra/auth/deviceService");
    const currentInstallationId = getCurrentInstallationId();
    mockState.rpc.mockResolvedValue({
      data: [
        {
          id: "device-current",
          installation_id: currentInstallationId,
          device_name: "Mac Web",
          client_kind: "web",
          platform: "MacIntel",
          ip_address: "127.0.0.1",
          auth_session_id: "session-1",
          first_seen_at: "2026-05-18T10:00:00Z",
          last_seen_at: "2026-05-18T11:00:00Z",
          revoked_at: null,
          status: "active",
        },
        {
          id: "device-old",
          installation_id: "other-installation",
          device_name: "iPhone",
          client_kind: "mobile",
          status: "revoked",
        },
      ],
      error: null,
    });

    const devices = await authDeviceService.listDevices();

    expect(mockState.rpc).toHaveBeenCalledWith("list_my_auth_devices");
    expect(devices).toEqual([
      expect.objectContaining({
        id: "device-current",
        installationId: currentInstallationId,
        deviceName: "Mac Web",
        status: "active",
        isCurrent: true,
      }),
      expect.objectContaining({
        id: "device-old",
        clientKind: "mobile",
        status: "revoked",
        isCurrent: false,
      }),
    ]);
  });

  it("revokuje zařízení přes vlastnické RPC", async () => {
    const { authDeviceService } = await import("@/infra/auth/deviceService");

    await authDeviceService.revokeDevice("device-1");

    expect(mockState.rpc).toHaveBeenCalledWith("revoke_my_auth_device", {
      p_device_id: "device-1",
    });
  });

  it("propaguje RPC chyby", async () => {
    mockState.rpc.mockResolvedValue({
      data: null,
      error: new Error("rpc failed"),
    });
    const { authDeviceService } = await import("@/infra/auth/deviceService");

    await expect(authDeviceService.listDevices()).rejects.toThrow("rpc failed");
  });
});

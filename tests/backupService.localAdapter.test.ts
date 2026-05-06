import { beforeEach, describe, expect, it, vi } from "vitest";

const dbAdapterMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));
const backupAdapterMock = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  getSettings: vi.fn(),
  list: vi.fn(),
  setEnabled: vi.fn(),
  setScheduledTime: vi.fn(),
  openFolder: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: dbAdapterMock,
}));
vi.mock("@infra/platform/platformAdapter", () => ({
  backupAdapter: backupAdapterMock,
}));

import { backupService } from "../features/backup/api/backupService";

describe("backupService local adapter boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje lokální backup nastavení do platform adaptéru", async () => {
    const settings = {
      enabled: true,
      backupFolderPath: "/tmp/backups",
      lastBackupAt: null,
      lastBackupError: null,
      scheduledTime: "03:00",
    };
    const backups = [
      {
        fileName: "backup.json",
        filePath: "/tmp/backups/backup.json",
        backupType: "user",
        organizationId: "org-1",
        createdAt: "2026-05-06T10:00:00.000Z",
        sizeBytes: 128,
      },
    ];
    backupAdapterMock.isAvailable.mockReturnValue(true);
    backupAdapterMock.getSettings.mockResolvedValue(settings);
    backupAdapterMock.list.mockResolvedValue(backups);
    backupAdapterMock.setEnabled.mockResolvedValue(undefined);
    backupAdapterMock.setScheduledTime.mockResolvedValue(undefined);
    backupAdapterMock.openFolder.mockResolvedValue(undefined);

    expect(backupService.isLocalBackupAvailable()).toBe(true);
    await expect(backupService.getLocalSettings()).resolves.toBe(settings);
    await expect(backupService.listLocalBackups()).resolves.toBe(backups);
    await backupService.setLocalBackupEnabled(false);
    await backupService.setLocalBackupScheduledTime("04:30");
    await backupService.openLocalBackupFolder();

    expect(backupAdapterMock.setEnabled).toHaveBeenCalledWith(false);
    expect(backupAdapterMock.setScheduledTime).toHaveBeenCalledWith("04:30");
    expect(backupAdapterMock.openFolder).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";

const fileSystemServiceMock = vi.hoisted(() => ({
  deleteFolder: vi.fn(),
  ensureStructure: vi.fn(),
  folderExists: vi.fn(),
}));

vi.mock("@/services/fileSystemService", () => fileSystemServiceMock);

import {
  deleteFolder,
  ensureStructure,
  folderExists,
} from "@infra/files/fileSystemService";

describe("infra file system service", () => {
  it("deleguje filesystem operace do legacy service", async () => {
    fileSystemServiceMock.folderExists.mockResolvedValue(true);
    fileSystemServiceMock.deleteFolder.mockResolvedValue({ success: true });
    fileSystemServiceMock.ensureStructure.mockResolvedValue({
      success: true,
      createdCount: 0,
      reusedCount: 1,
      logs: [],
    });

    await expect(folderExists("/tmp/doc-hub")).resolves.toBe(true);
    await expect(deleteFolder("/tmp/doc-hub", "/tmp/doc-hub/supplier")).resolves.toEqual({
      success: true,
    });
    await expect(
      ensureStructure({ rootPath: "/tmp/doc-hub", categories: [] }),
    ).resolves.toMatchObject({ success: true, reusedCount: 1 });

    expect(fileSystemServiceMock.folderExists).toHaveBeenCalledWith("/tmp/doc-hub");
    expect(fileSystemServiceMock.deleteFolder).toHaveBeenCalledWith(
      "/tmp/doc-hub",
      "/tmp/doc-hub/supplier",
    );
    expect(fileSystemServiceMock.ensureStructure).toHaveBeenCalledWith({
      rootPath: "/tmp/doc-hub",
      categories: [],
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAttachment } from "@/types";

const fileSystemMocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/services/fileSystemService", () => ({
  pickFile: fileSystemMocks.pickFile,
  readFile: fileSystemMocks.readFile,
}));

import { loadBudgetAttachmentForEmail } from "@/services/budgetAttachmentService";

const attachment: BudgetAttachment = {
  source: "dochub",
  fileName: "rozpocet.xlsx",
  relativePath: "Podklady/rozpocet.xlsx",
  size: 1024,
  selectedAt: "2026-07-09T20:00:00.000Z",
  enabled: true,
};

describe("budgetAttachmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pred nactenim preda main procesu limit 10 MB", async () => {
    fileSystemMocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    await expect(
      loadBudgetAttachmentForEmail("/Tender/Vyberove-rizeni", attachment),
    ).resolves.toEqual({
      filename: "rozpocet.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64Content: "AQID",
    });

    expect(fileSystemMocks.readFile).toHaveBeenCalledWith(
      "/Tender/Vyberove-rizeni/Podklady/rozpocet.xlsx",
      { maxBytes: 10 * 1024 * 1024 },
    );
  });

  it("zachova kontrolu velikosti i po nacteni jako druhou ochranu", async () => {
    fileSystemMocks.readFile.mockResolvedValue(new Uint8Array(10 * 1024 * 1024 + 1));

    await expect(
      loadBudgetAttachmentForEmail("/Tender/Vyberove-rizeni", attachment),
    ).rejects.toThrow("Příloha je větší než povolený limit 10 MB.");
  });
});

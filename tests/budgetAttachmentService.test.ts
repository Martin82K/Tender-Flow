import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAttachment } from "@/types";

const fileSystemMocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  readFile: vi.fn(),
  copyFile: vi.fn(),
}));

vi.mock("@/services/fileSystemService", () => ({
  pickFile: fileSystemMocks.pickFile,
  readFile: fileSystemMocks.readFile,
  copyFile: fileSystemMocks.copyFile,
}));

import {
  copyPendingBudgetAttachment,
  loadBudgetAttachmentForEmail,
  selectPendingBudgetAttachment,
} from "@/services/budgetAttachmentService";

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

  it("vybere zdrojovou prilohu bez pozadavku na existujici slozku VR", async () => {
    fileSystemMocks.pickFile.mockResolvedValue({
      path: "/Users/tester/Downloads/rozpocet.xlsx",
      name: "rozpocet.xlsx",
      size: 1234,
    });

    await expect(selectPendingBudgetAttachment()).resolves.toEqual({
      sourcePath: "/Users/tester/Downloads/rozpocet.xlsx",
      fileName: "rozpocet.xlsx",
      size: 1234,
    });
    expect(fileSystemMocks.pickFile).toHaveBeenCalledWith({
      title: "Vybrat rozpočtovou přílohu",
    });
  });

  it("po vytvoreni slozky zkopiruje pending prilohu a vrati relativni metadata", async () => {
    fileSystemMocks.copyFile.mockResolvedValue({
      success: true,
      path: "/Projects/Stavba/Betony/rozpocet (2).xlsx",
      name: "rozpocet (2).xlsx",
      size: 1234,
    });

    await expect(
      copyPendingBudgetAttachment("/Projects/Stavba/Betony", {
        sourcePath: "/Users/tester/Downloads/rozpocet.xlsx",
        fileName: "rozpocet.xlsx",
        size: 1234,
      }),
    ).resolves.toEqual(expect.objectContaining({
      source: "dochub",
      fileName: "rozpocet (2).xlsx",
      relativePath: "rozpocet (2).xlsx",
      size: 1234,
      enabled: true,
    }));
  });

  it("neulozi metadata kdyz kopirovani selze", async () => {
    fileSystemMocks.copyFile.mockResolvedValue({
      success: false,
      error: "Access denied",
    });

    await expect(
      copyPendingBudgetAttachment("/Projects/Stavba/Betony", {
        sourcePath: "/Users/tester/Downloads/rozpocet.xlsx",
        fileName: "rozpocet.xlsx",
      }),
    ).rejects.toThrow("Access denied");
  });

  it("odmitne podvrzenou cilovou cestu mimo slozku VR", async () => {
    fileSystemMocks.copyFile.mockResolvedValue({
      success: true,
      path: "/Projects/Stavba/jine-vr/rozpocet.xlsx",
      name: "rozpocet.xlsx",
      size: 1234,
    });

    await expect(
      copyPendingBudgetAttachment("/Projects/Stavba/Betony", {
        sourcePath: "/Users/tester/Downloads/rozpocet.xlsx",
        fileName: "rozpocet.xlsx",
      }),
    ).rejects.toThrow("Zkopírovaná příloha není uvnitř složky tohoto VŘ.");
  });
});

import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getContractByIdMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/contractService", () => ({
  contractService: {
    getContractById: getContractByIdMock,
  },
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: fromMock,
  },
}));

import {
  generateContractProtocol,
  generateContractProtocolPdf,
} from "@/features/projects/api/generateContractProtocol";

const createTemplateBuffer = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("List1");
  worksheet.getCell("B31").value = "1310/OSM/08";
  worksheet.getCell("C132").value = "BAU-STAV a.s.";
  worksheet.getCell("A120").value = "dodávek v souladu dle SOD č. 1310/OSM/08";
  const buffer = await workbook.xlsx.writeBuffer();
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  throw new Error("Cannot create template buffer");
};

const mockContract = {
  id: "contract-1",
  projectId: "project-1",
  vendorName: "KLIMA - ELEKTRON s.r.o.",
  vendorIco: "12345678",
  title: "VZT",
  contractNumber: "SOD-2026-001",
  status: "active",
  signedAt: "2026-01-10",
  effectiveFrom: "2026-01-15",
  effectiveTo: "2026-03-20",
  currency: "CZK",
  basePrice: 100000,
  source: "manual",
  amendments: [
    {
      id: "a1",
      contractId: "contract-1",
      amendmentNo: 1,
      deltaPrice: 5000,
    },
  ],
  drawdowns: [],
  currentTotal: 105000,
  approvedSum: 0,
  remaining: 105000,
};

describe("generateContractProtocol integration", () => {
  beforeEach(async () => {
    getContractByIdMock.mockReset();
    fromMock.mockReset();

    getContractByIdMock.mockResolvedValue(mockContract);
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: "project-1",
              name: "REKO Bazén Aš",
              status: "realization",
              investor: "Město Aš",
              technical_supervisor: "TDI Test",
              location: "Aš",
              finish_date: "2026-03-20",
              site_manager: "Ing. Jan Novák",
              construction_manager: "Petr Svoboda",
              construction_technician: "Technik",
            },
            error: null,
          }),
        }),
      }),
    }));

    const template = await createTemplateBuffer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => template,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("vrátí draft režim bez souboru", async () => {
    const result = await generateContractProtocol({
      documentKind: "sub_work_handover",
      contractId: "contract-1",
      projectId: "project-1",
      mode: "draft",
    });

    expect(result.arrayBuffer).toBeNull();
    expect(result.draft.documentKind).toBe("sub_work_handover");
    expect(result.fileName).toContain("predani_dila_sub");
  });

  it("vygeneruje SUB protokol", async () => {
    const result = await generateContractProtocol({
      documentKind: "sub_work_handover",
      contractId: "contract-1",
      projectId: "project-1",
      mode: "generate",
      overrides: {
        issuerCompany: "Tender Flow a.s.",
      },
    });

    expect(result.arrayBuffer).not.toBeNull();

    expect(result.arrayBuffer?.byteLength).toBeGreaterThan(0);
    expect(result.draft.fields.issuerCompany).toBe("Tender Flow a.s.");
    expect(result.draft.fields.subcontractorCompany).toBe(
      "KLIMA - ELEKTRON s.r.o.",
    );
    expect(result.draft.fields.contractNumber).toBe("SOD-2026-001");
  });

  it("vygeneruje site handover a přepíše placeholdery ve vzoru", async () => {
    const result = await generateContractProtocol({
      documentKind: "site_handover",
      contractId: "contract-1",
      projectId: "project-1",
      mode: "generate",
      overrides: {
        acceptanceStatement: "Nový text předání dle aktuální smlouvy.",
      },
    });

    expect(result.arrayBuffer?.byteLength).toBeGreaterThan(0);
    expect(result.draft.fields.contractNumber).toBe("SOD-2026-001");
    expect(result.draft.fields.signContractorCompany).toBe(
      "KLIMA - ELEKTRON s.r.o.",
    );
    expect(result.draft.fields.acceptanceStatement).toBe(
      "Nový text předání dle aktuální smlouvy.",
    );
    expect(result.templateStatus).toBe("provisional");
  });

  it("vygeneruje PDF pro předání díla SUB", async () => {
    const result = await generateContractProtocolPdf({
      documentKind: "sub_work_handover",
      contractId: "contract-1",
      projectId: "project-1",
      overrides: {
        issuerCompany: "Tender Flow a.s.",
      },
    });

    expect(result.fileName).toContain(".pdf");
    expect(result.arrayBuffer.byteLength).toBeGreaterThan(1000);
    const header = new TextDecoder("latin1")
      .decode(result.arrayBuffer.slice(0, 5))
      .toUpperCase();
    expect(header).toContain("%PDF");
    expect(result.draft.fields.issuerCompany).toBe("Tender Flow a.s.");
  });

  it("pro jiné typy dokumentu PDF export zamítne", async () => {
    await expect(
      generateContractProtocolPdf({
        documentKind: "site_handover",
        contractId: "contract-1",
        projectId: "project-1",
      }),
    ).rejects.toThrow(/pouze pro Předání díla SUB/i);
  });
});

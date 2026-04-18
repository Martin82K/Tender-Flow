import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { getContractProtocolDefinition } from "@/features/projects/model/contractDocumentRegistry";
import { buildContractProtocolDraft } from "@/features/projects/model/contractProtocolUtils";
import type { ContractWithDetails, ProjectDetails } from "@/types";

const mockContract: ContractWithDetails = {
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
  invoices: [],
  currentTotal: 105000,
  approvedSum: 0,
  remaining: 105000,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
};

const mockProject: ProjectDetails = {
  id: "project-1",
  title: "REKO Bazén Aš",
  location: "Aš",
  finishDate: "2026-03-20",
  siteManager: "Ing. Jan Novák",
  constructionManager: "Petr Svoboda",
  technicalSupervisor: "TDI Test",
  investor: "Město Aš",
  categories: [],
};

describe("contract document registry", () => {
  it("vytvoří draft pro SUB předání", () => {
    const definition = getContractProtocolDefinition("sub_work_handover");
    const draft = buildContractProtocolDraft(
      definition,
      definition.buildDraft({
        contract: mockContract,
        projectDetails: mockProject,
        today: new Date("2026-03-01T12:00:00Z"),
      }),
    );

    expect(definition.actionLabel).toBe("Předání díla SUB");
    expect(draft.fields.subcontractorCompany).toBe("KLIMA - ELEKTRON s.r.o.");
    expect(draft.fields.contractNumber).toBe("SOD-2026-001");
    expect(draft.missingFields).not.toContain("issuerCompany");
    expect(draft.fieldOrder).not.toContain("issuerCompany");
  });

  it("vytvoří draft pro předání staveniště jako provisional", () => {
    const definition = getContractProtocolDefinition("site_handover");
    const draft = buildContractProtocolDraft(
      definition,
      definition.buildDraft({
        contract: mockContract,
        projectDetails: mockProject,
        today: new Date("2026-03-01T12:00:00Z"),
      }),
    );

    expect(definition.templateStatus).toBe("provisional");
    expect(draft.fields.contractNumber).toBe("SOD-2026-001");
    expect(draft.fields.contractorCompany).toBe("KLIMA - ELEKTRON s.r.o.");
  });

  it("zapisuje hodnoty do správných buněk a přepisuje placeholdery", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("List1");

    const subDefinition = getContractProtocolDefinition("sub_work_handover");
    subDefinition.applyToWorksheet(worksheet, {
      fields: {
        subcontractorCompany: "=SUM(A1:A2)",
        contractNumber: "SOD-26",
        projectName: "REKO Bazén Aš",
        siteLocation: "Aš",
        takeoverActualAt: "1. 3. 2026",
      },
      context: {
        contract: mockContract,
        projectDetails: mockProject,
        today: new Date("2026-03-01T12:00:00Z"),
      },
    });

    expect(worksheet.getCell("G11").value).toBe("'=SUM(A1:A2)");
    expect(worksheet.getCell("G14").value).toBe("SOD-26");

    const siteDefinition = getContractProtocolDefinition("site_handover");
    siteDefinition.applyToWorksheet(worksheet, {
      fields: {
        contractNumber: "NEW-SOD-1",
        signContractorCompany: "NOVÁ FIRMA",
        acceptanceStatement: "Aktualizovaný text předání.",
      },
      context: {
        contract: mockContract,
        projectDetails: mockProject,
        today: new Date("2026-03-01T12:00:00Z"),
      },
    });

    expect(worksheet.getCell("B31").value).toBe("NEW-SOD-1");
    expect(worksheet.getCell("C132").value).toBe("NOVÁ FIRMA");
    expect(worksheet.getCell("A120").value).toBe("Aktualizovaný text předání.");

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

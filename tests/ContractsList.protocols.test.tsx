import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContractProtocolMock = vi.hoisted(() => vi.fn());
const generateContractProtocolPdfMock = vi.hoisted(() => vi.fn());
const getOrganizationLogoUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/projects/api/generateContractProtocol", () => ({
  generateContractProtocol: (...args: unknown[]) =>
    generateContractProtocolMock(...args),
  generateContractProtocolPdf: (...args: unknown[]) =>
    generateContractProtocolPdfMock(...args),
}));

vi.mock("@/services/platformAdapter", () => ({
  isDesktop: false,
  shellAdapter: {
    openTempBinaryFile: vi.fn(),
  },
}));

vi.mock("@/services/organizationService", () => ({
  organizationService: {
    getOrganizationLogoUrl: (...args: unknown[]) => getOrganizationLogoUrlMock(...args),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "kalkus@baustav.cz",
      organizationName: "Baustav",
      organizationId: "org-1",
    },
  }),
}));

vi.mock("../components/projectLayoutComponents/contractsComponents/ContractForm", () => ({
  ContractForm: () => <div>ContractFormMock</div>,
}));

vi.mock(
  "../components/projectLayoutComponents/contractsComponents/ExtractionValidation",
  () => ({
    ExtractionValidation: () => <div>ExtractionValidationMock</div>,
  }),
);

vi.mock("@/shared/contracts/MarkdownDocumentPanel", () => ({
  MarkdownDocumentPanel: () => <div>MarkdownDocumentPanelMock</div>,
}));

import { ContractsList } from "../components/projectLayoutComponents/contractsComponents/ContractsList";

const contract = {
  id: "contract-1",
  projectId: "project-1",
  vendorName: "KLIMA - ELEKTRON s.r.o.",
  title: "VZT",
  contractNumber: "SOD-2026-001",
  status: "active",
  currency: "CZK",
  basePrice: 100000,
  source: "manual",
  amendments: [],
  drawdowns: [],
  currentTotal: 100000,
  approvedSum: 0,
  remaining: 100000,
};

const projectDetails = {
  id: "project-1",
  title: "REKO Bazén Aš",
  location: "Aš",
  finishDate: "2026-03-20",
  siteManager: "Ing. Jan Novák",
  categories: [],
};

const draft = {
  documentKind: "sub_work_handover" as const,
  actionLabel: "Předání díla SUB",
  templateStatus: "final" as const,
  fields: {
    subcontractorCompany: "KLIMA - ELEKTRON s.r.o.",
    subcontractorRepresentative: "",
  },
  fieldOrder: ["subcontractorCompany", "subcontractorRepresentative"],
  fieldMeta: {
    subcontractorCompany: {
      key: "subcontractorCompany",
      label: "Subdodavatel",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    subcontractorRepresentative: {
      key: "subcontractorRepresentative",
      label: "Zástupce subdodavatele",
      required: false,
      autofill: false,
      manualOnly: true,
    },
  },
  requiredFields: ["subcontractorCompany"],
  autofillFields: ["subcontractorCompany"],
  manualOnlyFields: ["subcontractorRepresentative"],
  missingFields: [],
};

describe("ContractsList protocol actions", () => {
  beforeEach(() => {
    generateContractProtocolMock.mockReset();
    generateContractProtocolPdfMock.mockReset();
    getOrganizationLogoUrlMock.mockReset();
    getOrganizationLogoUrlMock.mockResolvedValue("https://cdn.example/logo.png");
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:protocol"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      writable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("otevře modal a vygeneruje SUB protokol z pravého kliku", async () => {
    generateContractProtocolMock
      .mockResolvedValueOnce({
        fileName: "predani_dila_sub_vzt.xlsx",
        arrayBuffer: null,
        missingFields: [],
        draft,
        templateStatus: "final",
      })
      .mockResolvedValueOnce({
        fileName: "predani_dila_sub_vzt.xlsx",
        arrayBuffer: new ArrayBuffer(16),
        missingFields: [],
        draft: {
          ...draft,
          missingFields: [],
          fields: { ...draft.fields, subcontractorRepresentative: "TF a.s." },
        },
        templateStatus: "final",
      });

    render(
      <ContractsList
        projectId="project-1"
        projectDetails={projectDetails as any}
        contracts={[contract as any]}
        onContractCreated={vi.fn()}
        onContractUpdated={vi.fn()}
        onContractDeleted={vi.fn()}
        onSelectContract={vi.fn()}
      />,
    );

    const rowTitle = screen.getByText("VZT");
    const row = rowTitle.closest("tr");
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row!);
    fireEvent.click(screen.getByText("Předání díla SUB"));

    await waitFor(() => {
      expect(generateContractProtocolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          documentKind: "sub_work_handover",
          mode: "draft",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Předání díla SUB")).toBeInTheDocument();
    });
    expect(screen.getByAltText("Baustav")).toBeInTheDocument();

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "TF a.s." } });

    fireEvent.click(screen.getByText("Vytvořit .xlsx"));

    await waitFor(() => {
      expect(generateContractProtocolMock).toHaveBeenCalledTimes(2);
    });

    expect(generateContractProtocolMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentKind: "sub_work_handover",
        mode: "generate",
        overrides: expect.objectContaining({ subcontractorCompany: "TF a.s." }),
      }),
    );
  });

  it("umožní export SUB protokolu do PDF", async () => {
    generateContractProtocolMock.mockResolvedValueOnce({
      fileName: "predani_dila_sub_vzt.xlsx",
      arrayBuffer: null,
      missingFields: [],
      draft,
      templateStatus: "final",
    });

    generateContractProtocolPdfMock.mockResolvedValueOnce({
      fileName: "predani_dila_sub_vzt.pdf",
      arrayBuffer: new ArrayBuffer(64),
      missingFields: [],
      draft: {
        ...draft,
        fields: {
          ...draft.fields,
          subcontractorCompany: "TF a.s.",
        },
        missingFields: [],
      },
    });

    render(
      <ContractsList
        projectId="project-1"
        projectDetails={projectDetails as any}
        contracts={[contract as any]}
        onContractCreated={vi.fn()}
        onContractUpdated={vi.fn()}
        onContractDeleted={vi.fn()}
        onSelectContract={vi.fn()}
      />,
    );

    const rowTitle = screen.getByText("VZT");
    const row = rowTitle.closest("tr");
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row!);
    fireEvent.click(screen.getByText("Předání díla SUB"));

    await waitFor(() => {
      expect(screen.getByText("Vytvořit PDF")).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "TF a.s." } });

    fireEvent.click(screen.getByText("Vytvořit PDF"));

    await waitFor(() => {
      expect(generateContractProtocolPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          documentKind: "sub_work_handover",
          overrides: expect.objectContaining({ subcontractorCompany: "TF a.s." }),
        }),
      );
    });
  });
});

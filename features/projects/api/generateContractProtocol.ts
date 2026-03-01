import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { RobotoRegularBase64 } from "@/fonts/roboto-regular";
import { contractService } from "@/services/contractService";
import { dbAdapter } from "@/services/dbAdapter";
import { organizationService } from "@/services/organizationService";
import type { ProjectDetails } from "@/types";

import { getContractProtocolDefinition } from "../model/contractDocumentRegistry";
import type {
  ContractProtocolGenerationMode,
  ContractProtocolDraft,
  GenerateContractProtocolInput,
  GenerateContractProtocolPdfResult,
  GenerateContractProtocolResult,
} from "../model/contractProtocolTypes";
import {
  applyFieldOverrides,
  buildContractProtocolDraft,
  sanitizeProtocolFileName,
} from "../model/contractProtocolUtils";

const registerRobotoFont = (doc: jsPDF): void => {
  doc.addFileToVFS("Roboto-Regular.ttf", RobotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal", "Identity-H");
};

const toArrayBuffer = (value: unknown): ArrayBuffer => {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }

  throw new Error("Nepodařilo se převést výstup šablony na ArrayBuffer.");
};

const buildFileName = (
  kind: GenerateContractProtocolInput["documentKind"],
  vendorName: string,
): string => {
  const kindLabel =
    kind === "sub_work_handover" ? "predani_dila_sub" : "predani_staveniste";
  const datePart = new Date().toISOString().split("T")[0];
  return sanitizeProtocolFileName(`${kindLabel}_${vendorName}_${datePart}.xlsx`);
};

const buildPdfFileName = (
  kind: GenerateContractProtocolInput["documentKind"],
  vendorName: string,
): string =>
  buildFileName(kind, vendorName).replace(/\.xlsx$/i, ".pdf");

const fetchProjectDetails = async (
  projectId: string,
  snapshot?: ProjectDetails,
): Promise<ProjectDetails> => {
  if (snapshot) return snapshot;

  const { data, error } = await dbAdapter
    .from("projects")
    .select(
      "id, name, status, investor, technical_supervisor, location, finish_date, site_manager, construction_manager, construction_technician",
    )
    .eq("id", projectId)
    .single();

  if (error || !data) {
    throw new Error("Nepodařilo se načíst detail projektu pro protokol.");
  }

  return {
    id: data.id,
    title: data.name || "",
    status: data.status || "realization",
    investor: data.investor || "",
    technicalSupervisor: data.technical_supervisor || "",
    location: data.location || "",
    finishDate: data.finish_date || "",
    siteManager: data.site_manager || "",
    constructionManager: data.construction_manager || "",
    constructionTechnician: data.construction_technician || "",
    categories: [],
  };
};

const resolveMode = (
  mode?: ContractProtocolGenerationMode,
): ContractProtocolGenerationMode => mode || "generate";

interface PreparedContractProtocol {
  definition: ReturnType<typeof getContractProtocolDefinition>;
  draft: ContractProtocolDraft;
  context: {
    contract: Awaited<ReturnType<typeof contractService.getContractById>>;
    projectDetails: ProjectDetails;
    today: Date;
  };
  contract: NonNullable<Awaited<ReturnType<typeof contractService.getContractById>>>;
}

const prepareContractProtocol = async (
  input: GenerateContractProtocolInput,
): Promise<PreparedContractProtocol> => {
  const definition = getContractProtocolDefinition(input.documentKind);

  const contract =
    input.contractSnapshot ||
    (await contractService.getContractById(input.contractId));

  if (!contract) {
    throw new Error("Smlouva pro vytvoření protokolu nebyla nalezena.");
  }

  const projectDetails = await fetchProjectDetails(
    input.projectId,
    input.projectDetailsSnapshot,
  );

  const context = {
    contract,
    projectDetails,
    today: new Date(),
  };

  const baseFields = definition.buildDraft(context);
  const fields = applyFieldOverrides(baseFields, input.overrides);
  const draft = buildContractProtocolDraft(definition, fields);

  return {
    definition,
    draft,
    context,
    contract,
  };
};

const formatDateForPdf = (date: Date): string =>
  date.toLocaleDateString("cs-CZ");

const resolveTenantLogoUrl = async (
  input: GenerateContractProtocolInput,
): Promise<string | null> => {
  if (input.organizationLogoUrl) {
    return input.organizationLogoUrl;
  }
  if (!input.organizationId) {
    return null;
  }

  try {
    return await organizationService.getOrganizationLogoUrl(input.organizationId, {
      expiresInSeconds: 1800,
    });
  } catch {
    return null;
  }
};

const drawProtocolPrintBranding = async (
  doc: jsPDF,
  pageWidth: number,
  marginX: number,
  logoUrl: string | null,
): Promise<void> => {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const contentType = logoResponse.headers.get("content-type") || "";
        const imageType = contentType.includes("svg")
          ? "SVG"
          : contentType.includes("webp")
            ? "WEBP"
            : contentType.includes("jpeg") || contentType.includes("jpg")
              ? "JPEG"
              : "PNG";
        const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
        doc.addImage(logoBytes, imageType, pageWidth - marginX - 36, 8, 36, 14);
        return;
      }
    } catch {
      // Bezpečný fallback níže.
    }
  }

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Tender Flow", pageWidth - marginX, 14, { align: "right" });
};

const renderSignatureSection = (
  doc: jsPDF,
  startY: number,
  marginX: number,
  pageWidth: number,
  leftSigner: string,
  rightSigner: string,
): void => {
  const gap = 10;
  const blockWidth = (pageWidth - marginX * 2 - gap) / 2;
  const leftX = marginX;
  const rightX = leftX + blockWidth + gap;
  const lineY = startY + 13;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text("Podpisy stran", marginX, startY);

  doc.setFontSize(9);
  doc.text("Za zhotovitele", leftX, startY + 7);
  doc.text("Za subdodavatele", rightX, startY + 7);

  doc.line(leftX, lineY, leftX + blockWidth, lineY);
  doc.line(rightX, lineY, rightX + blockWidth, lineY);

  if (leftSigner.trim()) {
    doc.text(leftSigner, leftX, lineY + 5);
  }
  if (rightSigner.trim()) {
    doc.text(rightSigner, rightX, lineY + 5);
  }
};

export const generateContractProtocol = async (
  input: GenerateContractProtocolInput,
): Promise<GenerateContractProtocolResult> => {
  const { definition, draft, context, contract } =
    await prepareContractProtocol(input);

  const mode = resolveMode(input.mode);
  const fileName = buildFileName(definition.kind, contract.vendorName || "dodavatel");

  if (mode === "draft") {
    return {
      fileName,
      arrayBuffer: null,
      missingFields: draft.missingFields,
      draft,
      templateStatus: definition.templateStatus,
    };
  }

  const templateResponse = await fetch(definition.templateAssetPath);
  if (!templateResponse.ok) {
    throw new Error(
      `Šablona protokolu nebyla načtena (${templateResponse.status}).`,
    );
  }

  const templateArrayBuffer = await templateResponse.arrayBuffer();
  const templateBytes = new Uint8Array(templateArrayBuffer);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Šablona protokolu neobsahuje žádný list.");
  }

  definition.applyToWorksheet(worksheet, { fields: draft.fields, context });

  const outputBuffer = await workbook.xlsx.writeBuffer();

  return {
    fileName,
    arrayBuffer: toArrayBuffer(outputBuffer),
    missingFields: draft.missingFields,
    draft,
    templateStatus: definition.templateStatus,
  };
};

export const generateContractProtocolPdf = async (
  input: GenerateContractProtocolInput,
): Promise<GenerateContractProtocolPdfResult> => {
  if (input.documentKind !== "sub_work_handover") {
    throw new Error("Export do PDF je zatím dostupný pouze pro Předání díla SUB.");
  }

  const { definition, draft, context, contract } =
    await prepareContractProtocol(input);

  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  registerRobotoFont(doc);
  doc.setFont("Roboto", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const tenantLogoUrl = await resolveTenantLogoUrl(input);
  await drawProtocolPrintBranding(doc, pageWidth, marginX, tenantLogoUrl);
  let y = 20;

  doc.setFontSize(16);
  doc.text(definition.actionLabel, marginX, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Projekt: ${context.projectDetails.title || "—"} | Dodavatel: ${contract.vendorName || "—"}`,
    marginX,
    y,
  );
  y += 5;
  doc.text(
    `Číslo smlouvy: ${contract.contractNumber || "—"} | Datum exportu: ${formatDateForPdf(
      context.today,
    )}`,
    marginX,
    y,
  );
  y += 7;

  if (draft.missingFields.length > 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.roundedRect(marginX, y - 3.5, pageWidth - marginX * 2, 8, 2, 2, "FD");
    doc.setTextColor(153, 27, 27);
    doc.text(
      `Chybějící údaje: ${draft.missingFields
        .map((key) => draft.fieldMeta[key]?.label || key)
        .join(", ")}`,
      marginX + 2,
      y + 1.5,
    );
    y += 10;
  }

  doc.setTextColor(15, 23, 42);

  const tableRows = draft.fieldOrder.map((fieldKey) => {
    const meta = draft.fieldMeta[fieldKey];
    const value = draft.fields[fieldKey] || "—";
    return [meta?.label || fieldKey, value];
  });

  autoTable(doc, {
    startY: y,
    head: [["Položka", "Hodnota"]],
    body: tableRows,
    styles: {
      font: "Roboto",
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      font: "Roboto",
      fontStyle: "normal",
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: "auto" },
    },
    margin: { left: marginX, right: marginX },
  });

  const autoTableState = doc as jsPDF & {
    lastAutoTable?: {
      finalY?: number;
    };
  };
  const tableBottomY = autoTableState.lastAutoTable?.finalY ?? y;

  const signatureSectionHeight = 24;
  let signatureStartY = tableBottomY + 11;
  if (signatureStartY + signatureSectionHeight > pageHeight - 12) {
    doc.addPage();
    signatureStartY = 20;
  }

  renderSignatureSection(
    doc,
    signatureStartY,
    marginX,
    pageWidth,
    draft.fields.issuerSigner || "",
    draft.fields.subcontractorSigner || "",
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Tender Flow | ${definition.actionLabel} | Strana ${i} z ${pageCount}`,
      marginX,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  const fileName = buildPdfFileName(
    definition.kind,
    contract.vendorName || "dodavatel",
  );

  return {
    fileName,
    arrayBuffer: doc.output("arraybuffer"),
    missingFields: draft.missingFields,
    draft,
  };
};

import ExcelJS from "exceljs";

import { contractService } from "@/services/contractService";
import { dbAdapter } from "@/services/dbAdapter";
import type { ProjectDetails } from "@/types";

import { getContractProtocolDefinition } from "../model/contractDocumentRegistry";
import type {
  ContractProtocolGenerationMode,
  GenerateContractProtocolInput,
  GenerateContractProtocolResult,
} from "../model/contractProtocolTypes";
import {
  applyFieldOverrides,
  buildContractProtocolDraft,
  sanitizeProtocolFileName,
} from "../model/contractProtocolUtils";

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

export const generateContractProtocol = async (
  input: GenerateContractProtocolInput,
): Promise<GenerateContractProtocolResult> => {
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

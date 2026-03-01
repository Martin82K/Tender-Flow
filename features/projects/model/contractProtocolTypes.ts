import type { ContractWithDetails, ProjectDetails } from "@/types";

export type ContractProtocolKind = "sub_work_handover" | "site_handover";

export type ContractProtocolTemplateStatus = "final" | "provisional";

export type ContractProtocolGenerationMode = "draft" | "generate";

export interface ContractProtocolFieldMeta {
  key: string;
  label: string;
  required: boolean;
  autofill: boolean;
  manualOnly: boolean;
  multiline?: boolean;
  placeholder?: string;
}

export interface ContractProtocolDraft {
  documentKind: ContractProtocolKind;
  actionLabel: string;
  templateStatus: ContractProtocolTemplateStatus;
  fields: Record<string, string>;
  fieldOrder: string[];
  fieldMeta: Record<string, ContractProtocolFieldMeta>;
  requiredFields: string[];
  autofillFields: string[];
  manualOnlyFields: string[];
  missingFields: string[];
}

export interface ContractProtocolContext {
  contract: ContractWithDetails;
  projectDetails: ProjectDetails;
  today: Date;
}

export interface GenerateContractProtocolInput {
  documentKind: ContractProtocolKind;
  contractId: string;
  projectId: string;
  organizationId?: string;
  organizationLogoUrl?: string;
  overrides?: Partial<Record<string, string>>;
  mode?: ContractProtocolGenerationMode;
  contractSnapshot?: ContractWithDetails;
  projectDetailsSnapshot?: ProjectDetails;
}

export interface GenerateContractProtocolResult {
  fileName: string;
  arrayBuffer: ArrayBuffer | null;
  missingFields: string[];
  draft: ContractProtocolDraft;
  templateStatus: ContractProtocolTemplateStatus;
  storageRef?: string;
}

export interface GenerateContractProtocolPdfResult {
  fileName: string;
  arrayBuffer: ArrayBuffer;
  missingFields: string[];
  draft: ContractProtocolDraft;
}

export interface ContractProtocolWorksheetInput {
  fields: Record<string, string>;
  context: ContractProtocolContext;
}

export interface ContractProtocolDefinition {
  kind: ContractProtocolKind;
  actionLabel: string;
  templateAssetPath: string;
  templateStatus: ContractProtocolTemplateStatus;
  fieldOrder: string[];
  fieldMeta: Record<string, Omit<ContractProtocolFieldMeta, "key">>;
  requiredFields: string[];
  autofillFields: string[];
  manualOnlyFields: string[];
  buildDraft: (context: ContractProtocolContext) => Record<string, string>;
  applyToWorksheet: (
    worksheet: import("exceljs").Worksheet,
    input: ContractProtocolWorksheetInput,
  ) => void;
}

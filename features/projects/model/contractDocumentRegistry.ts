import type { ContractProtocolDefinition } from "./contractProtocolTypes";
import {
  formatCzechDate,
  formatCurrencyCzk,
  setWorksheetText,
} from "./contractProtocolUtils";

const subWorkHandoverDefinition: ContractProtocolDefinition = {
  kind: "sub_work_handover",
  actionLabel: "Předání díla SUB",
  templateAssetPath: "/forms/contract-protocols/sub-work-handover-template.xlsx",
  templateStatus: "final",
  fieldOrder: [
    "issuerRepresentative",
    "subcontractorCompany",
    "subcontractorRepresentative",
    "contractNumber",
    "projectName",
    "siteLocation",
    "workSubject",
    "qualityDocuments",
    "asBuiltDocuments",
    "takeoverScheduledAt",
    "takeoverActualAt",
    "delayPenalty",
    "defectsList",
    "defectsRemovalAt",
    "siteClearanceAt",
    "defectsPenalty",
    "irreparableDefectsDiscount",
    "warrantyStartAt",
    "warrantySecurity",
    "takeoverDeclarationDate",
    "issuerSigner",
    "subcontractorSigner",
  ],
  fieldMeta: {
    issuerRepresentative: {
      label: "Zástupce zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    subcontractorCompany: {
      label: "Subdodavatel",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    subcontractorRepresentative: {
      label: "Zástupce subdodavatele",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    contractNumber: {
      label: "Číslo smlouvy",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    projectName: {
      label: "Stavební akce",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    siteLocation: {
      label: "Místo",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    workSubject: {
      label: "Předmět díla",
      required: true,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    qualityDocuments: {
      label: "Doklady o jakosti / zkouškách",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    asBuiltDocuments: {
      label: "Dokumentace skutečného provedení",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    takeoverScheduledAt: {
      label: "Termín přejímky (smluvní)",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    takeoverActualAt: {
      label: "Termín přejímky (skutečný)",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    delayPenalty: {
      label: "Smluvní pokuta za termín",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    defectsList: {
      label: "Soupis vad a nedodělků",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    defectsRemovalAt: {
      label: "Termín odstranění vad",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    siteClearanceAt: {
      label: "Termín vyklizení pracoviště",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    defectsPenalty: {
      label: "Pokuta za neodstranění vad",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    irreparableDefectsDiscount: {
      label: "Snížení ceny za neopravitelné vady",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    warrantyStartAt: {
      label: "Počátek záruční doby",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    warrantySecurity: {
      label: "Jistina záruční doby",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    takeoverDeclarationDate: {
      label: "Datum převzetí",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    issuerSigner: {
      label: "Podpis za zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    subcontractorSigner: {
      label: "Podpis za subdodavatele",
      required: false,
      autofill: false,
      manualOnly: true,
    },
  },
  requiredFields: [
    "subcontractorCompany",
    "contractNumber",
    "projectName",
    "siteLocation",
    "workSubject",
    "takeoverActualAt",
    "takeoverDeclarationDate",
  ],
  autofillFields: [
    "issuerRepresentative",
    "subcontractorCompany",
    "contractNumber",
    "projectName",
    "siteLocation",
    "workSubject",
    "takeoverScheduledAt",
    "takeoverActualAt",
    "warrantyStartAt",
    "warrantySecurity",
    "takeoverDeclarationDate",
    "issuerSigner",
  ],
  manualOnlyFields: [
    "subcontractorRepresentative",
    "qualityDocuments",
    "asBuiltDocuments",
    "delayPenalty",
    "defectsList",
    "defectsRemovalAt",
    "siteClearanceAt",
    "defectsPenalty",
    "irreparableDefectsDiscount",
    "subcontractorSigner",
  ],
  buildDraft: (context) => {
    const contract = context.contract;
    const project = context.projectDetails;
    const currentTotal =
      typeof contract.currentTotal === "number" && contract.currentTotal > 0
        ? contract.currentTotal
        : contract.basePrice;

    const warrantySecurity =
      typeof contract.retentionPercent === "number"
        ? `${contract.retentionPercent} %`
        : typeof contract.retentionAmount === "number"
          ? formatCurrencyCzk(contract.retentionAmount)
          : currentTotal > 0
            ? formatCurrencyCzk(currentTotal * 0.05)
            : "";

    const today = formatCzechDate(context.today);

    return {
      issuerRepresentative: project.siteManager || "",
      subcontractorCompany: contract.vendorName || "",
      subcontractorRepresentative: "",
      contractNumber: contract.contractNumber || "",
      projectName: project.title || contract.title || "",
      siteLocation: project.location || "",
      workSubject: contract.scopeSummary || contract.title || "",
      qualityDocuments: "",
      asBuiltDocuments: "",
      takeoverScheduledAt: formatCzechDate(contract.effectiveTo || project.finishDate),
      takeoverActualAt: today,
      delayPenalty: "",
      defectsList: "",
      defectsRemovalAt: "",
      siteClearanceAt: "",
      defectsPenalty: "",
      irreparableDefectsDiscount: "",
      warrantyStartAt: today,
      warrantySecurity,
      takeoverDeclarationDate: today,
      issuerSigner: project.siteManager || "",
      subcontractorSigner: "",
    };
  },
  applyToWorksheet: (worksheet, input) => {
    const { fields } = input;

    const cellMap: Record<string, string> = {
      issuerRepresentative: "G9",
      subcontractorCompany: "G11",
      subcontractorRepresentative: "G12",
      contractNumber: "G14",
      projectName: "G16",
      siteLocation: "G17",
      workSubject: "C19",
      qualityDocuments: "A23",
      asBuiltDocuments: "A25",
      takeoverScheduledAt: "G26",
      takeoverActualAt: "G27",
      delayPenalty: "G29",
      defectsList: "A31",
      defectsRemovalAt: "G33",
      siteClearanceAt: "G34",
      defectsPenalty: "G35",
      irreparableDefectsDiscount: "G36",
      warrantyStartAt: "G37",
      warrantySecurity: "G38",
      takeoverDeclarationDate: "G39",
      issuerSigner: "B48",
      subcontractorSigner: "G48",
    };

    Object.entries(cellMap).forEach(([key, address]) => {
      setWorksheetText(worksheet, address, fields[key]);
    });
  },
};

const siteHandoverDefinition: ContractProtocolDefinition = {
  kind: "site_handover",
  actionLabel: "Předání staveniště",
  templateAssetPath:
    "/forms/contract-protocols/site-handover-provisional-template.xlsx",
  templateStatus: "provisional",
  fieldOrder: [
    "protocolStartDate",
    "protocolNumber",
    "projectNameNumber",
    "siteLocation",
    "district",
    "contractorCompany",
    "contractorRepresentative",
    "contractorIco",
    "customerCompany",
    "customerRepresentative",
    "customerIco",
    "contractNumber",
    "contractSignedAt",
    "amendmentCount",
    "scheduleStartContract",
    "scheduleStartActual",
    "scheduleEndContract",
    "delayReasons",
    "priceWithoutVat",
    "priceWithVat",
    "handedDocumentation",
    "documentsDuringWork",
    "deviationsReason",
    "defectsList",
    "accessAgreement",
    "siteClearanceAgreement",
    "additionalAgreements",
    "acceptanceStatement",
    "warrantyInfo",
    "handoverEndDate",
    "signContractorCompany",
    "signContractorLocation",
    "signCustomerCompany",
    "signTechnicalSupervisor",
  ],
  fieldMeta: {
    protocolStartDate: {
      label: "Datum zahájení přejímacího řízení",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    protocolNumber: {
      label: "Číslo zápisu",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    projectNameNumber: {
      label: "Název a číslo stavby",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    siteLocation: {
      label: "Místo stavby",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    district: {
      label: "Okres",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    contractorCompany: {
      label: "Zhotovitel",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    contractorRepresentative: {
      label: "Odpovědný pracovník zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    contractorIco: {
      label: "IČ zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    customerCompany: {
      label: "Objednatel",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    customerRepresentative: {
      label: "Technický dozor objednatele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    customerIco: {
      label: "IČ objednatele",
      required: false,
      autofill: false,
      manualOnly: true,
    },
    contractNumber: {
      label: "Smlouva o dílo č.",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    contractSignedAt: {
      label: "Smlouva ze dne",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    amendmentCount: {
      label: "Počet dodatků",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    scheduleStartContract: {
      label: "Datum zahájení prací dle SOD",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    scheduleStartActual: {
      label: "Skutečné zahájení prací",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    scheduleEndContract: {
      label: "Termín dokončení prací dle SOD",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    delayReasons: {
      label: "Důvody nedodržení termínů",
      required: false,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    priceWithoutVat: {
      label: "Cena bez DPH",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    priceWithVat: {
      label: "Cena vč. DPH + rezervy",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    handedDocumentation: {
      label: "Předaná dokumentace (příloha)",
      required: false,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    documentsDuringWork: {
      label: "Dokumentace předaná během realizace",
      required: false,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    deviationsReason: {
      label: "Odchylky od projektu",
      required: false,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    defectsList: {
      label: "Soupis vad a nedodělků",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    accessAgreement: {
      label: "Dohoda o vstupu pracovníků",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    siteClearanceAgreement: {
      label: "Dohoda o vyklizení staveniště",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    additionalAgreements: {
      label: "Další ujednání",
      required: false,
      autofill: false,
      manualOnly: true,
      multiline: true,
    },
    acceptanceStatement: {
      label: "Text předání/převzetí",
      required: false,
      autofill: true,
      manualOnly: false,
      multiline: true,
    },
    warrantyInfo: {
      label: "Text záruční doby",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    handoverEndDate: {
      label: "Datum skončení přejímacího řízení",
      required: true,
      autofill: true,
      manualOnly: false,
    },
    signContractorCompany: {
      label: "Podpis - firma zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    signContractorLocation: {
      label: "Podpis - sídlo zhotovitele",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    signCustomerCompany: {
      label: "Podpis - objednatel",
      required: false,
      autofill: true,
      manualOnly: false,
    },
    signTechnicalSupervisor: {
      label: "Podpis - technický dozor",
      required: false,
      autofill: true,
      manualOnly: false,
    },
  },
  requiredFields: [
    "protocolStartDate",
    "projectNameNumber",
    "siteLocation",
    "contractorCompany",
    "customerCompany",
    "contractNumber",
    "handoverEndDate",
  ],
  autofillFields: [
    "protocolStartDate",
    "protocolNumber",
    "projectNameNumber",
    "siteLocation",
    "contractorCompany",
    "contractorRepresentative",
    "contractorIco",
    "customerCompany",
    "customerRepresentative",
    "contractNumber",
    "contractSignedAt",
    "amendmentCount",
    "scheduleStartContract",
    "scheduleStartActual",
    "scheduleEndContract",
    "delayReasons",
    "priceWithoutVat",
    "priceWithVat",
    "handedDocumentation",
    "documentsDuringWork",
    "deviationsReason",
    "acceptanceStatement",
    "warrantyInfo",
    "handoverEndDate",
    "signContractorCompany",
    "signContractorLocation",
    "signCustomerCompany",
    "signTechnicalSupervisor",
  ],
  manualOnlyFields: [
    "district",
    "customerIco",
    "defectsList",
    "accessAgreement",
    "siteClearanceAgreement",
    "additionalAgreements",
  ],
  buildDraft: (context) => {
    const contract = context.contract;
    const project = context.projectDetails;

    const today = formatCzechDate(context.today);
    const currentTotal =
      typeof contract.currentTotal === "number" && contract.currentTotal > 0
        ? contract.currentTotal
        : contract.basePrice;

    const priceWithVat =
      currentTotal > 0 ? formatCurrencyCzk(Math.round(currentTotal * 1.21)) : "";

    const contractNumber = contract.contractNumber || "";
    const warrantyMonths =
      contract.warrantyMonths || project.contract?.warranty || 60;

    return {
      protocolStartDate: today,
      protocolNumber: contractNumber,
      projectNameNumber: project.title || contract.title || "",
      siteLocation: project.location || "",
      district: "",
      contractorCompany: contract.vendorName || "",
      contractorRepresentative:
        project.constructionManager || project.siteManager || "",
      contractorIco: contract.vendorIco || "",
      customerCompany: project.investor || "",
      customerRepresentative: project.technicalSupervisor || "",
      customerIco: "",
      contractNumber,
      contractSignedAt: formatCzechDate(contract.signedAt),
      amendmentCount: String(contract.amendments?.length || 0),
      scheduleStartContract: formatCzechDate(contract.effectiveFrom),
      scheduleStartActual: today,
      scheduleEndContract: formatCzechDate(contract.effectiveTo || project.finishDate),
      delayReasons: "žádné",
      priceWithoutVat: formatCurrencyCzk(currentTotal),
      priceWithVat,
      handedDocumentation: "příloha č. 1",
      documentsDuringWork: "žádná",
      deviationsReason: "viz projekt skutečného provedení",
      defectsList: "",
      accessAgreement: "",
      siteClearanceAgreement: "",
      additionalAgreements: "",
      acceptanceStatement: `Oprávnění zástupci zhotovitele předávají objednateli předmět díla dle SOD č. ${contractNumber || ""}.`,
      warrantyInfo: `Záruční doba na dílo - ${warrantyMonths} měsíců viz smlouva o dílo č. ${contractNumber || ""}`,
      handoverEndDate: today,
      signContractorCompany: contract.vendorName || "",
      signContractorLocation: project.location || "",
      signCustomerCompany: project.investor || "",
      signTechnicalSupervisor: project.technicalSupervisor || "",
    };
  },
  applyToWorksheet: (worksheet, input) => {
    const { fields } = input;

    const cellMap: Record<string, string> = {
      protocolStartDate: "B7",
      protocolNumber: "G7",
      projectNameNumber: "B9",
      siteLocation: "B11",
      district: "G11",
      contractorCompany: "B23",
      contractorRepresentative: "G23",
      contractorIco: "B26",
      customerCompany: "B27",
      customerRepresentative: "G27",
      customerIco: "B30",
      contractNumber: "B31",
      contractSignedAt: "E31",
      amendmentCount: "G31",
      scheduleStartContract: "B62",
      scheduleStartActual: "E62",
      scheduleEndContract: "H62",
      delayReasons: "D66",
      priceWithoutVat: "B69",
      priceWithVat: "H69",
      handedDocumentation: "D73",
      documentsDuringWork: "A83",
      deviationsReason: "A90",
      defectsList: "A94",
      accessAgreement: "A102",
      siteClearanceAgreement: "A106",
      additionalAgreements: "A110",
      acceptanceStatement: "A120",
      warrantyInfo: "A123",
      handoverEndDate: "B125",
      signContractorCompany: "C132",
      signContractorLocation: "C133",
      signCustomerCompany: "C144",
      signTechnicalSupervisor: "C155",
    };

    Object.entries(cellMap).forEach(([key, address]) => {
      setWorksheetText(worksheet, address, fields[key]);
    });
  },
};

const definitionsByKind = {
  sub_work_handover: subWorkHandoverDefinition,
  site_handover: siteHandoverDefinition,
} satisfies Record<
  ContractProtocolDefinition["kind"],
  ContractProtocolDefinition
>;

export const getContractProtocolDefinition = (
  kind: ContractProtocolDefinition["kind"],
): ContractProtocolDefinition => {
  const definition = definitionsByKind[kind];
  if (!definition) {
    throw new Error(`Nepodporovaný typ protokolu: ${kind}`);
  }
  return definition;
};

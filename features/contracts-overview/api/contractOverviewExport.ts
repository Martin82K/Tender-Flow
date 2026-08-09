import type { ContractOverviewRow } from "./contractOverviewApi";
import {
  CONTRACT_OVERVIEW_PARAMETER_LABELS,
  formatContractOverviewDate,
  formatContractOverviewPercent,
  getContractOverviewStatusLabel,
  type ContractOverviewParameterKey,
} from "../model/contractOverviewModel";

const safeCell = (value: string | number): string | number => {
  if (typeof value === "number") return value;
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
};

const parameterValue = (row: ContractOverviewRow, key: ContractOverviewParameterKey): string => {
  switch (key) {
    case "warranty": return row.warrantyMonths == null ? "" : `${row.warrantyMonths} měs.`;
    case "warrantyEnd": return formatContractOverviewDate(row.warrantyEnd);
    case "retentionShort": return formatContractOverviewPercent(row.retentionShortPercent);
    case "retentionShortRelease": return formatContractOverviewDate(row.retentionShortReleaseOn);
    case "retentionLong": return formatContractOverviewPercent(row.retentionLongPercent);
    case "retentionLongRelease": return formatContractOverviewDate(row.retentionLongReleaseOn);
    case "warrantyRetention": return formatContractOverviewPercent(row.warrantyRetentionPercent);
    case "warrantyRetentionRelease": return formatContractOverviewDate(row.warrantyRetentionReleaseOn);
    case "maturity": return row.maturityDays == null ? "" : `${row.maturityDays} dní`;
    case "paymentTerms": return row.paymentTerms || "";
  }
};

export const buildContractOverviewExportRows = (
  rows: ContractOverviewRow[],
  visibleParameters: ContractOverviewParameterKey[],
): Array<Array<string | number>> => {
  const header = [
    "Typ řádku", "Stavba", "Partner", "Smlouva", "Dokument smlouvy", "Stav",
    "Limit / aktuální hodnota", "Čerpání", "Zbývá", "Hodnota dodatku",
    ...visibleParameters.map((key) => CONTRACT_OVERVIEW_PARAMETER_LABELS[key]),
  ];
  const output: Array<Array<string | number>> = [header];

  for (const row of rows) {
    output.push([
      "Smlouva",
      safeCell(row.projectName),
      safeCell(row.contractPartner),
      safeCell([row.contractTitle, row.contractNumber].filter(Boolean).join(" · ")),
      safeCell(row.documentFileName || (row.documentUrl || row.documentStoragePath ? "Připojený dokument" : "")),
      safeCell(getContractOverviewStatusLabel(row.contractStatus)),
      row.currentTotal,
      row.approvedDrawdown,
      row.remainingAmount,
      "",
      ...visibleParameters.map((key) => safeCell(parameterValue(row, key))),
    ]);

    for (const amendment of row.amendments) {
      output.push([
        "Dodatek",
        safeCell(row.projectName),
        safeCell(row.contractPartner),
        safeCell(`Dodatek č. ${amendment.amendmentNo}`),
        safeCell(amendment.documentFileName || (amendment.documentUrl || amendment.documentStoragePath ? "Připojený dokument" : "")),
        safeCell(amendment.status ? getContractOverviewStatusLabel(amendment.status) : ""),
        "",
        "",
        "",
        amendment.deltaPrice,
        ...visibleParameters.map(() => ""),
      ]);
    }
  }
  return output;
};

export const exportContractOverviewToExcel = async (
  rows: ContractOverviewRow[],
  visibleParameters: ContractOverviewParameterKey[],
): Promise<void> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(buildContractOverviewExportRows(rows, visibleParameters));
  sheet["!cols"] = [
    { wch: 12 }, { wch: 28 }, { wch: 26 }, { wch: 34 }, { wch: 24 },
    { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
    ...visibleParameters.map(() => ({ wch: 24 })),
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Smluvní přehled");
  XLSX.writeFile(workbook, `smluvni_prehled_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

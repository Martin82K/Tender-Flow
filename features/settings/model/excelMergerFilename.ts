export const buildExcelMergerOutputFilename = (inputName: string): string => {
  const baseName = inputName.trim().replace(/\.xlsx$/i, "");
  return `${baseName || "excel"}_spojeno.xlsx`;
};

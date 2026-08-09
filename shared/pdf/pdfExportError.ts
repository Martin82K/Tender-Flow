export const PDF_EXPORT_ERROR_MESSAGE =
  "PDF se nepodařilo exportovat. Zkuste to znovu nebo obnovte aplikaci.";

type SetPdfExportError = (message: string | null) => void;

export const runPdfExportSafely = async (
  exportAction: () => Promise<void>,
  setError: SetPdfExportError,
): Promise<boolean> => {
  setError(null);

  try {
    await exportAction();
    return true;
  } catch {
    setError(PDF_EXPORT_ERROR_MESSAGE);
    return false;
  }
};

import { useCallback, useRef, useState } from "react";

export const useFileExport = () => {
  const pending = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const runExport = useCallback(async (action: () => Promise<void>): Promise<void> => {
    if (pending.current) return;
    pending.current = true;
    setIsExporting(true);
    setExportError(null);
    try {
      await action();
    } catch {
      setExportError("Soubor se nepodařilo exportovat. Zkuste to znovu nebo obnovte aplikaci.");
    } finally {
      pending.current = false;
      setIsExporting(false);
    }
  }, []);

  return { runExport, isExporting, exportError };
};

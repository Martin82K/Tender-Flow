import type { ExcelUnlockWorkerMessage, UnlockExcelZipResult } from "./excelUnlockZipCore";

export type { UnlockExcelZipResult } from "./excelUnlockZipCore";

const UNLOCK_TIMEOUT_MS = 60_000;

export const unlockExcelZipWithStats = (
  input: ArrayBuffer | Uint8Array,
  opts?: { onProgress?: (percent: number, label: string) => void },
): Promise<UnlockExcelZipResult> => new Promise((resolve, reject) => {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./excelUnlock.worker.ts", import.meta.url), { type: "module" });
  } catch {
    reject(new Error("Bezpečné zpracování souboru se nepodařilo spustit. Zkuste aplikaci znovu otevřít."));
    return;
  }

  const finish = (error?: Error, result?: UnlockExcelZipResult) => {
    clearTimeout(timeout);
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    if (error) reject(error);
    else if (result) resolve(result);
  };
  const timeout = setTimeout(() => finish(new Error(
    "Zpracování překročilo časový limit. Ověřte soubor nebo zkuste menší sešit.",
  )), UNLOCK_TIMEOUT_MS);

  worker.onmessage = (event: MessageEvent<ExcelUnlockWorkerMessage>) => {
    const message = event.data;
    if (message.type === "result") {
      finish(undefined, { output: message.output, worksheetCount: message.worksheetCount });
    } else if (message.type === "error") {
      finish(new Error(message.message));
    } else {
      try {
        opts?.onProgress?.(message.percent, message.label);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Zpracování souboru bylo přerušeno."));
      }
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    finish(new Error("Zpracování souboru selhalo. Ověřte, že jde o platný Excel sešit."));
  };
  worker.onmessageerror = () => finish(new Error("Výsledek zpracování souboru se nepodařilo načíst."));

  try {
    // Transfer a copy: preserve the caller's buffer and any Uint8Array subrange.
    const bytes = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input.slice(0));
    worker.postMessage(bytes, [bytes.buffer]);
  } catch (error) {
    finish(error instanceof Error ? error : new Error("Soubor se nepodařilo předat ke zpracování."));
  }
});

export const unlockExcelZip = async (
  input: ArrayBuffer | Uint8Array,
  opts?: { onProgress?: (percent: number, label: string) => void },
): Promise<Uint8Array> => (await unlockExcelZipWithStats(input, opts)).output;

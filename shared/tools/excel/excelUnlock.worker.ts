import { unlockExcelZipCore } from "./excelUnlockZipCore";
import type { ExcelUnlockWorkerMessage } from "./excelUnlockZipCore";

const send = (message: ExcelUnlockWorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<Uint8Array>) => {
  try {
    const result = await unlockExcelZipCore(event.data, {
      onProgress: (percent, label) => send({ type: "progress", percent, label }),
    });
    const message: ExcelUnlockWorkerMessage = { type: "result", ...result };
    self.postMessage(message, { transfer: [result.output.buffer] });
  } catch (error) {
    send({ type: "error", message: error instanceof Error ? error.message : "Neplatný Excel soubor." });
  }
};

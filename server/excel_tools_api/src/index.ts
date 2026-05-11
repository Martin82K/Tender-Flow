import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { pathToFileURL } from "node:url";
import { mergeWorkbookToSingleSheet } from "./merge";
import {
  corsGuardMiddleware,
  createRateLimitMiddleware,
  getMaxUploadBytes,
  handleUploadError,
  requireContentLengthLimit,
  requireMergeAuth,
  sanitizeDownloadFilename,
  securityHeadersMiddleware,
} from "./security";

export const createExcelToolsApp = () => {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: getMaxUploadBytes() },
  });

  app.use(securityHeadersMiddleware);
  app.use(corsGuardMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/merge",
    requireMergeAuth,
    createRateLimitMiddleware(),
    requireContentLengthLimit,
    upload.single("file"),
    handleUploadError,
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).send("Chyba: Žádný soubor nebyl nahrán");
        return;
      }

      const name = file.originalname || "input.xlsx";
      const lower = name.toLowerCase();
      if (!lower.endsWith(".xlsx")) {
        res.status(400).send("Chyba: Podporované jsou pouze soubory .xlsx");
        return;
      }

      try {
        const out = await mergeWorkbookToSingleSheet(file.buffer);
        const downloadName = sanitizeDownloadFilename(name, "_combined_final.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        );
        res.status(200).send(out);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[excel-tools-api] /merge failed", e instanceof Error ? e.message : String(e));
        res.status(500).send("Chyba při zpracování Excel souboru");
      }
    },
  );

  return app;
};

const isEntrypoint = import.meta.url === pathToFileURL(process.argv[1] || "").href;

if (isEntrypoint) {
  const port = Number(process.env.EXCEL_TOOLS_PORT || process.env.PORT || 5001);
  createExcelToolsApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[excel-tools-api] listening on :${port}`);
  });
}

import cors from "cors";
import express from "express";
import multer from "multer";
import { mergeWorkbookToSingleSheet } from "./merge";

const app = express();
app.use(cors({ origin: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/merge", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).send("Chyba: Žádný soubor nebyl nahrán");
    return;
  }

  const name = file.originalname || "input.xlsx";
  const lower = name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
    res.status(400).send("Chyba: Podporované jsou pouze soubory .xlsx a .xlsm");
    return;
  }

  try {
    const out = await mergeWorkbookToSingleSheet(file.buffer);
    const base = name.replace(/\.(xlsx|xlsm)$/i, "");
    const downloadName = `${base}_combined_final.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.status(200).send(out);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[excel-tools-api] /merge failed", e);
    res.status(500).send(`Chyba při zpracování: ${e?.stack || e?.message || String(e)}`);
  }
});

const port = Number(process.env.EXCEL_TOOLS_PORT || process.env.PORT || 5001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[excel-tools-api] listening on :${port}`);
});

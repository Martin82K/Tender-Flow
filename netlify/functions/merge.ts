import Busboy from "busboy";
import { mergeWorkbookToSingleSheet } from "./_excelMerge";

const parseMultipartFile = async (event: any): Promise<{ filename: string; data: Buffer }> => {
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"];
  if (!contentType || !String(contentType).includes("multipart/form-data")) {
    throw new Error("Expected multipart/form-data");
  }

  const body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : Buffer.from(event.body || "", "utf8");

  return await new Promise((resolve, reject) => {
    const bb = Busboy({ headers: { "content-type": contentType } });
    let fileName = "input.xlsx";
    const chunks: Buffer[] = [];

    bb.on("file", (_field, file, info) => {
      fileName = info?.filename || fileName;
      file.on("data", (d: Buffer) => chunks.push(d));
      file.on("limit", () => reject(new Error("File too large")));
      file.on("error", reject);
    });

    bb.on("error", reject);
    bb.on("finish", () => {
      const data = Buffer.concat(chunks);
      if (!data.length) {
        reject(new Error("No file received"));
        return;
      }
      resolve({ filename: fileName, data });
    });

    bb.end(body);
  });
};

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { filename, data } = await parseMultipartFile(event);
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
      return { statusCode: 400, body: "Chyba: Podporované jsou pouze soubory .xlsx a .xlsm" };
    }

    const out = await mergeWorkbookToSingleSheet(data);
    const base = filename.replace(/\.(xlsx|xlsm)$/i, "");
    const downloadName = `${base}_combined_final.xlsx`;

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "no-store",
      },
      body: out.toString("base64"),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      body: e?.stack || e?.message || String(e),
    };
  }
};


import type { BudgetAttachment } from "@/types";
import { pickFile, readFile } from "@/services/fileSystemService";
import {
  buildBudgetAttachmentMetadata,
  isPathInsideDirectory,
  MAX_EMAIL_ATTACHMENT_BYTES,
  resolveBudgetAttachmentPath,
} from "@/features/projects/model/budgetAttachmentModel";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  base64Content: string;
}

const extensionContentTypes: Record<string, string> = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const getContentType = (filename: string): string => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return extensionContentTypes[extension] || "application/octet-stream";
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const selectBudgetAttachment = async (
  tenderFolderPath: string,
): Promise<BudgetAttachment | null> => {
  const selected = await pickFile({
    title: "Vybrat rozpočtovou přílohu",
    defaultPath: tenderFolderPath,
  });

  if (selected.cancelled) {
    return null;
  }

  if (!selected.path) {
    throw new Error(selected.error || "Soubor nebyl vybrán.");
  }

  const attachment = buildBudgetAttachmentMetadata({
    filePath: selected.path,
    tenderFolderPath,
    size: selected.size,
  });

  if (!attachment) {
    throw new Error("Vybraný soubor musí být uložený ve složce tohoto VŘ.");
  }

  return attachment;
};

export const loadBudgetAttachmentForEmail = async (
  tenderFolderPath: string,
  attachment: BudgetAttachment,
): Promise<EmailAttachment> => {
  const filePath = resolveBudgetAttachmentPath(tenderFolderPath, attachment);

  if (!isPathInsideDirectory(filePath, tenderFolderPath)) {
    throw new Error("Příloha není uvnitř složky tohoto VŘ.");
  }

  const bytes = await readFile(filePath, { maxBytes: MAX_EMAIL_ATTACHMENT_BYTES });
  if (bytes.byteLength > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new Error("Příloha je větší než povolený limit 10 MB.");
  }

  return {
    filename: attachment.fileName,
    contentType: getContentType(attachment.fileName),
    base64Content: bytesToBase64(bytes),
  };
};

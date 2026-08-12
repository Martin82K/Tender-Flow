import type { MouseEvent } from "react";

import type { DemandDocument } from "@/types";
import { formatFileSize, getDocumentUrl } from "@/services/documentService";

export interface PipelineCategoryDocumentsProps {
  documents: DemandDocument[];
  onOpenError: (message: string) => void;
}

const DOCUMENT_OPEN_ERROR =
  "Dokument se nepodařilo otevřít. Zkuste to prosím znovu.";

export const PipelineCategoryDocuments = ({
  documents,
  onOpenError,
}: PipelineCategoryDocumentsProps) => {
  if (documents.length === 0) return null;

  const handleOpenDocument = async (
    event: MouseEvent<HTMLAnchorElement>,
    documentPath: string,
  ) => {
    event.preventDefault();
    try {
      const signedUrl = await getDocumentUrl(documentPath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      console.error("Pipeline document could not be opened.");
      onOpenError(DOCUMENT_OPEN_ERROR);
    }
  };

  return (
    <div className="px-6 pt-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">
            folder_open
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Přiložené dokumenty
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <a
              key={document.id}
              href={document.url}
              onClick={(event) => {
                void handleOpenDocument(event, document.url);
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span className="material-symbols-outlined text-[20px] text-slate-400">
                description
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700 group-hover:text-primary dark:text-slate-200">
                  {document.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatFileSize(document.size)}
                </p>
              </div>
              <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">
                download
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

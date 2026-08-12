import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PipelineBulkEmailKind } from "@features/projects/model/pipelineEmailModel";
import { PipelineBulkEmailMenu } from "@features/projects/ui/PipelineBulkEmailMenu";

export interface PipelineDetailToolbarProps {
  categoryTitle: string;
  canOpenDocHub: boolean;
  inquiryRecipientCount: number;
  loserRecipientCount: number;
  onBack: () => void;
  onAddSubcontractor: () => void;
  onSelectBulkEmail: (kind: PipelineBulkEmailKind) => void;
  onOpenDocHub: () => void | Promise<void>;
  onExport: (format: "xlsx" | "pdf") => void | Promise<void>;
}

const MENU_MARGIN_PX = 8;
const MENU_WIDTH_PX = 224;

export const PipelineDetailToolbar: React.FC<PipelineDetailToolbarProps> = ({
  categoryTitle,
  canOpenDocHub,
  inquiryRecipientCount,
  loserRecipientCount,
  onBack,
  onAddSubcontractor,
  onSelectBulkEmail,
  onOpenDocHub,
  onExport,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  const closeExportMenu = (restoreFocus = false) => {
    setIsExportMenuOpen(false);
    if (restoreFocus) exportButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeExportMenu(true);
    };
    const handleViewportChange = () => closeExportMenu();

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isExportMenuOpen]);

  const toggleExportMenu = () => {
    if (isExportMenuOpen) {
      closeExportMenu();
      return;
    }
    if (!exportButtonRef.current) return;

    const rect = exportButtonRef.current.getBoundingClientRect();
    const maximumLeft = Math.max(
      MENU_MARGIN_PX,
      window.innerWidth - MENU_WIDTH_PX - MENU_MARGIN_PX,
    );
    setMenuPosition({
      top: rect.bottom + MENU_MARGIN_PX,
      left: Math.min(
        Math.max(MENU_MARGIN_PX, rect.right - MENU_WIDTH_PX),
        maximumLeft,
      ),
    });
    setIsExportMenuOpen(true);
  };

  const handleExport = (format: "xlsx" | "pdf") => {
    closeExportMenu();
    void onExport(format);
  };

  return (
    <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto pb-1 [&>button]:shrink-0 [&>div]:shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="mr-auto flex items-center gap-2 px-2 text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        title="Vrátit se na přehled výběrových řízení"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          arrow_back
        </span>
        <span className="text-sm font-medium">Zpět na přehled</span>
      </button>
      <button
        type="button"
        data-help-id="kanban-add-supplier"
        onClick={onAddSubcontractor}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
        title="Přidat dodavatele do tohoto výběrového řízení"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          add
        </span>
        <span>Přidat dodavatele</span>
      </button>

      <PipelineBulkEmailMenu
        inquiryRecipientCount={inquiryRecipientCount}
        loserRecipientCount={loserRecipientCount}
        onSelect={onSelectBulkEmail}
      />

      {canOpenDocHub ? (
        <button
          type="button"
          onClick={() => void onOpenDocHub()}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
          aria-label={`Otevřít složku: ${categoryTitle}`}
          title={`Otevřít složku: ${categoryTitle}`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            folder_open
          </span>
        </button>
      ) : null}

      <div data-help-id="kanban-export" className="relative">
        <button
          ref={exportButtonRef}
          type="button"
          data-help-id="pipeline-export-trigger"
          onClick={toggleExportMenu}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-haspopup="menu"
          aria-expanded={isExportMenuOpen}
          aria-controls={isExportMenuOpen ? "pipeline-export-menu" : undefined}
          aria-label="Otevřít nabídku exportních formátů"
          title="Otevřít nabídku exportních formátů"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            download
          </span>
        </button>

        {isExportMenuOpen
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                  aria-label="Zavřít nabídku exportních formátů"
                  onClick={() => closeExportMenu(true)}
                />
                <div
                  id="pipeline-export-menu"
                  data-help-id="pipeline-export-menu"
                  role="menu"
                  aria-label="Formáty exportu"
                  className="tf-pipeline-popover fixed z-[9999] w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
                  style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                  <button
                    type="button"
                    onClick={() => handleExport("xlsx")}
                    data-help-id="pipeline-popover-item"
                    role="menuitem"
                    className="tf-pipeline-popover-item flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                    title="Exportovat výběrové řízení do Excelu"
                  >
                    <span className="tf-pipeline-popover-icon material-symbols-outlined text-[20px] text-green-600" aria-hidden="true">
                      table_chart
                    </span>
                    <span>
                      <span className="tf-pipeline-popover-label block text-sm font-medium text-slate-900 dark:text-white">
                        Excel
                      </span>
                      <span className="tf-pipeline-popover-description block text-xs text-slate-500 dark:text-slate-400">
                        .xlsx formát
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    data-help-id="pipeline-popover-item"
                    role="menuitem"
                    className="tf-pipeline-popover-item flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                    title="Exportovat výběrové řízení do PDF"
                  >
                    <span className="tf-pipeline-popover-icon material-symbols-outlined text-[20px] text-red-600" aria-hidden="true">
                      picture_as_pdf
                    </span>
                    <span>
                      <span className="tf-pipeline-popover-label block text-sm font-medium text-slate-900 dark:text-white">
                        PDF
                      </span>
                      <span className="tf-pipeline-popover-description block text-xs text-slate-500 dark:text-slate-400">
                        .pdf formát
                      </span>
                    </span>
                  </button>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
};

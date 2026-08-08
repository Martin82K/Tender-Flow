import React, { useState } from "react";
import { ProjectDetails, DocumentLink } from "../../../types";
import { isProbablyUrl, isSafePublicHttpUrlForExternalShortener } from "../../../utils/docHub";
import { shortenUrl } from "../../../services/urlShortenerService";
import { useAuth } from "../../../context/AuthContext";
import { openInExplorer } from "../../../services/fileSystemService";
import { isDesktop, shellAdapter } from "../../../services/platformAdapter";

interface DocsLinkSectionProps {
  project: ProjectDetails;
  hasDocsLink: boolean;
  isEditing: boolean;
  onEditToggle: (isEditing: boolean) => void;
  linkValue: string;
  onLinkValueChange: (value: string) => void;
  onSave: () => void;
  showModal: (args: {
    title: string;
    message: string;
    variant?: "success" | "danger" | "info";
    copyableText?: string;
  }) => void;
  onUpdate: (updates: Partial<ProjectDetails>) => void;
}

export const DocsLinkSection: React.FC<DocsLinkSectionProps> = ({
  project,
  hasDocsLink,
  isEditing,
  onEditToggle,
  linkValue,
  onLinkValueChange,
  onSave,
  showModal,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{
    label: string;
    url: string;
    dateAdded: string;
  }>({ label: "", url: "", dateAdded: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isShortening, setIsShortening] = useState(false);

  const documentLinks = project.documentLinks || [];

  const handleAddLink = async () => {
    if (!newLink.label.trim() || !newLink.url.trim()) {
      showModal({
        title: "Chyba",
        message: "Vyplňte název a odkaz/cestu.",
        variant: "danger",
      });
      return;
    }

    let finalUrl = newLink.url.trim();

    // Auto-shorten if enabled in settings
    if (
      user?.preferences?.autoShortenProjectDocs &&
      isSafePublicHttpUrlForExternalShortener(finalUrl)
    ) {
      setIsShortening(true);
      try {
        const result = await shortenUrl(finalUrl);
        if (result.success && result.shortUrl) {
          finalUrl = result.shortUrl;
        } else {
          console.warn("Auto-shortening failed:", result.error);
          // Optional: Notify user that shortening failed, but we proceed with original URL?
          // For now, we just proceed with the original URL silently or log it.
        }
      } catch (error) {
        console.error("Auto-shortening error:", error);
      } finally {
        setIsShortening(false);
      }
    }

    const link: DocumentLink = {
      id: crypto.randomUUID(),
      label: newLink.label.trim(),
      url: finalUrl,
      dateAdded: newLink.dateAdded || new Date().toISOString().split("T")[0],
    };
    onUpdate({ documentLinks: [...documentLinks, link] });
    setNewLink({ label: "", url: "", dateAdded: "" });
    setIsAddingNew(false);
  };

  const handleDeleteLink = (id: string) => {
    onUpdate({ documentLinks: documentLinks.filter((l) => l.id !== id) });
  };

  const copyPathToClipboard = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showModal({ title: "Zkopírováno", message: path, variant: "success" });
    } catch {
      showModal({
        title: "Zkopírujte cestu",
        message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
        variant: "info",
        copyableText: path,
      });
    }
  };

  const isSafeDocumentUrl = (target: string): boolean => {
    try {
      const parsed = new URL(target);
      return parsed.protocol === "https:" || parsed.protocol === "mailto:";
    } catch {
      return false;
    }
  };

  const handleOpenLink = async (target: string) => {
    if (isProbablyUrl(target)) {
      if (!isSafeDocumentUrl(target)) {
        showModal({
          title: "Odkaz se nepodařilo otevřít",
          message: "Z bezpečnostních důvodů lze otevírat jen HTTPS odkazy.",
          variant: "danger",
          copyableText: target,
        });
        return;
      }

      try {
        await shellAdapter.openExternal(target);
      } catch {
        showModal({
          title: "Odkaz se nepodařilo otevřít",
          message: "Zkontrolujte, že je odkaz platný a povolený pro otevření v aplikaci.",
          variant: "danger",
          copyableText: target,
        });
      }
      return;
    }

    if (isDesktop) {
      const result = await openInExplorer(target);
      if (result.success) return;

      showModal({
        title: "Složku se nepodařilo otevřít",
        message: "Aplikace nemá přístup k této lokální cestě nebo složka neexistuje. Cestu můžete zkopírovat ručně:",
        variant: "danger",
        copyableText: target,
      });
      return;
    }

    await copyPathToClipboard(target);
  };

  const getOpenButtonTitle = (target: string): string =>
    isProbablyUrl(target) || isDesktop ? "Otevřít" : "Zkopírovat";

  const getOpenButtonIcon = (target: string): string =>
    isProbablyUrl(target) || isDesktop ? "open_in_new" : "content_copy";

  return (
    <div className="space-y-4">
      {/* Multi-link list */}
      <div
        data-help-id="documents-link-card"
        className={`rounded-lg border p-4 transition-colors ${documentLinks.length > 0 || hasDocsLink
          ? "border-primary/20 bg-primary/5"
          : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30"
          }`}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400">
              folder_open
            </span>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Dokumenty projektu
            </h3>
            {(documentLinks.length > 0 || hasDocsLink) && (
              <span
                data-help-id="documents-status-badge"
                className="ml-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {documentLinks.length || 1} odkaz
                {documentLinks.length !== 1 ? "ů" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Links list */}
        <div className="space-y-2">
          {/* Legacy link from documentationLink */}
          {hasDocsLink && documentLinks.length === 0 && (
            <div
              data-help-id="documents-link-row"
              className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="material-symbols-outlined text-emerald-400">
                  description
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    PD
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {project.documentationLink}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenLink(project.documentationLink!)}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                  title={getOpenButtonTitle(project.documentationLink || "")}
                  aria-label={getOpenButtonTitle(project.documentationLink || "")}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {getOpenButtonIcon(project.documentationLink || "")}
                  </span>
                </button>
                <button
                  onClick={() => onEditToggle(true)}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                  title="Upravit"
                  aria-label="Upravit odkaz"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    edit
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* New multi-links */}
          {documentLinks.map((link) => (
            <div
              key={link.id}
              data-help-id="documents-link-row"
              className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="material-symbols-outlined text-emerald-400">
                  folder
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {link.label}
                    </span>
                    {link.dateAdded && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                        {new Date(link.dateAdded).toLocaleDateString("cs-CZ")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {link.url}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenLink(link.url)}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                  title={getOpenButtonTitle(link.url)}
                  aria-label={`${getOpenButtonTitle(link.url)} odkaz`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {getOpenButtonIcon(link.url)}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  title="Smazat"
                  aria-label="Smazat odkaz"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                </button>
              </div>
            </div>
          ))}

          {/* Add new link form */}
          {isAddingNew ? (
            <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newLink.label}
                  onChange={(e) =>
                    setNewLink({ ...newLink, label: e.target.value })
                  }
                  placeholder="Název (např. PD Hlavní budova)"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                />
                <input
                  type="date"
                  value={newLink.dateAdded}
                  onChange={(e) =>
                    setNewLink({ ...newLink, dateAdded: e.target.value })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={newLink.url}
                onChange={(e) =>
                  setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder="URL nebo cesta (např. https://... nebo C:\Projekty\...)"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewLink({ label: "", url: "", dateAdded: "" });
                  }}
                  className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleAddLink}
                  disabled={isShortening}
                  data-help-id="documents-save-link"
                  className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-50"
                >
                  {isShortening && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  )}
                  {isShortening ? "Zkracuji..." : "Přidat"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingNew(true)}
              data-help-id="documents-add-link"
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-500 transition-colors hover:border-primary/40 hover:bg-slate-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="text-sm font-medium">Přidat odkaz</span>
            </button>
          )}
        </div>

        {documentLinks.length === 0 && !hasDocsLink && !isAddingNew && (
          <p className="text-xs text-slate-500 text-center mt-3">
            Zatím nemáte žádné odkazy na dokumenty. Přidejte první odkaz.
          </p>
        )}
      </div>
    </div>
  );
};

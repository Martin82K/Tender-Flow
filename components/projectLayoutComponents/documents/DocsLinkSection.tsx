import React, { useState } from "react";
import { ProjectDetails, DocumentLink } from "../../../types";
import { isProbablyUrl } from "../../../utils/docHub";
import { shortenUrl } from "../../../services/urlShortenerService";

interface DocsLinkSectionProps {
  project: ProjectDetails;
  hasDocsLink: boolean;
  isEditing: boolean;
  onEditToggle: (isEditing: boolean) => void;
  linkValue: string;
  onLinkValueChange: (value: string) => void;
  onSave: () => void;
  isDocHubConnected: boolean;
  docHubPdLink: string | null;
  docHubStructure: { pd: string };
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
  isDocHubConnected,
  docHubPdLink,
  docHubStructure,
  showModal,
  onUpdate,
}) => {
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

    // URL shortening disabled - we keep full URLs so they can be displayed
    // as formatted links in HTML emails (e.g., EML files with clickable text)

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

  const handleOpenLink = async (url: string) => {
    if (isProbablyUrl(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showModal({ title: "Zkopírováno", message: url, variant: "success" });
      } catch {
        showModal({
          title: "Zkopírujte cestu",
          message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
          variant: "info",
          copyableText: url,
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Multi-link list */}
      <div
        className={`rounded-xl p-6 border transition-colors ${documentLinks.length > 0 || hasDocsLink
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
          : "bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/40"
          }`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400">
              folder_open
            </span>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Dokumenty projektu
            </h3>
            {(documentLinks.length > 0 || hasDocsLink) && (
              <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
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
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 group hover:border-emerald-500/30 transition-all">
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
                  className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                  title={
                    isProbablyUrl(project.documentationLink || "")
                      ? "Otevřít"
                      : "Zkopírovat"
                  }
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isProbablyUrl(project.documentationLink || "")
                      ? "open_in_new"
                      : "content_copy"}
                  </span>
                </button>
                <button
                  onClick={() => onEditToggle(true)}
                  className="p-2 text-slate-500 hover:text-blue-400 transition-colors"
                  title="Upravit"
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
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 group hover:border-emerald-500/30 transition-all"
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
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenLink(link.url)}
                  className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                  title={isProbablyUrl(link.url) ? "Otevřít" : "Zkopírovat"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isProbablyUrl(link.url) ? "open_in_new" : "content_copy"}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  title="Smazat"
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
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-300 dark:border-slate-600/50 space-y-3">
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
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
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600/50 rounded-xl text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all"
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

      {/* DocHub PD link */}
      {isDocHubConnected && docHubPdLink && (
        <div className="mt-4 rounded-xl p-4 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-300">
                folder
              </span>
              <div>
                <div className="text-sm font-semibold text-violet-900 dark:text-white">
                  DocHub /{docHubStructure.pd}
                </div>
                <div className="text-xs text-violet-700/70 dark:text-slate-400">
                  Rychlý odkaz na PD složku v DocHubu
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const value = docHubPdLink || "";
                if (isProbablyUrl(value)) {
                  window.open(value, "_blank", "noopener,noreferrer");
                  return;
                }
                try {
                  await navigator.clipboard.writeText(value);
                  showModal({
                    title: "Zkopírováno",
                    message: value,
                    variant: "success",
                  });
                } catch {
                  showModal({
                    title: "Zkopírujte cestu",
                    message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
                    variant: "info",
                    copyableText: value,
                  });
                }
              }}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {isProbablyUrl(docHubPdLink || "") ? "Otevřít" : "Zkopírovat"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

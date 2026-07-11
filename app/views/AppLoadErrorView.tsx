import React from "react";
import { formatIncidentReference } from "@/shared/errors/incidentReference";

interface AppLoadErrorViewProps {
  error: string;
  errorCode: string;
  incidentId?: string | null;
  onReload: () => void;
  onLogout: () => void;
}

export const AppLoadErrorView: React.FC<AppLoadErrorViewProps> = ({
  error,
  errorCode,
  incidentId,
  onReload,
  onLogout,
}) => {
  const reference = formatIncidentReference({ errorCode, incidentId });

  const handleCopyReference = (): void => {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(reference).catch(() => undefined);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 p-4 text-center">
      <div className="text-red-500 text-5xl">
        <span className="material-symbols-outlined text-6xl">error</span>
      </div>
      <h1 className="text-2xl font-bold">Chyba při načítání</h1>
      <p className="text-gray-400 max-w-md">{error}</p>
      <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
        <p className="whitespace-pre-line text-left font-mono text-sm text-gray-200">
          {reference}
        </p>
        <button
          type="button"
          onClick={handleCopyReference}
          className="rounded-md p-2 text-gray-300 hover:bg-gray-700 hover:text-white"
          title="Kopírovat referenci chyby"
          aria-label="Kopírovat referenci chyby"
        >
          <span className="material-symbols-outlined">content_copy</span>
        </button>
      </div>
      <div className="flex gap-4">
        <button
          onClick={onReload}
          className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg font-bold"
        >
          Obnovit stránku
        </button>
        <button
          onClick={onLogout}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
        >
          Odhlásit se
        </button>
      </div>
    </div>
  );
};

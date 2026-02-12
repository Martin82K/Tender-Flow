import React from "react";

interface AppLoadErrorViewProps {
  error: string;
  onReload: () => void;
  onLogout: () => void;
}

export const AppLoadErrorView: React.FC<AppLoadErrorViewProps> = ({
  error,
  onReload,
  onLogout,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 p-4 text-center">
      <div className="text-red-500 text-5xl">
        <span className="material-symbols-outlined text-6xl">error</span>
      </div>
      <h1 className="text-2xl font-bold">Chyba při načítání</h1>
      <p className="text-gray-400 max-w-md">{error}</p>
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

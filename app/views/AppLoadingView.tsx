import React from "react";

interface AppLoadingViewProps {
  authLoading: boolean;
  isDataLoading: boolean;
  appLoadProgress?: {
    percent?: number;
    label?: string;
  } | null;
}

export const AppLoadingView: React.FC<AppLoadingViewProps> = ({
  authLoading,
  isDataLoading,
  appLoadProgress,
}) => {
  const percent = appLoadProgress?.percent;
  const label = appLoadProgress?.label;

  let loadingMessage = "Načítám aplikaci...";
  if (authLoading && isDataLoading) {
    loadingMessage = "Načítám aplikaci a data...";
  } else if (authLoading) {
    loadingMessage = "Ověřování přihlášení...";
  } else if (isDataLoading) {
    loadingMessage = "Načítám data...";
  }

  const displayPercent =
    typeof percent === "number" ? percent : authLoading ? 30 : isDataLoading ? 60 : 0;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4 px-6 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      <div className="w-full max-w-sm">
        <p className="text-lg font-medium mb-4">{loadingMessage}</p>
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{
                width: `${Math.max(0, Math.min(100, displayPercent))}%`,
              }}
            />
          </div>
          {label && <div className="mt-3 text-sm text-white/70 truncate">{label}</div>}
        </div>
      </div>
    </div>
  );
};

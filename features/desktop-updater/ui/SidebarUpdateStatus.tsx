import React from "react";

import { useElectronUpdater } from "@infra/desktop/useElectronUpdater";

interface SidebarUpdateStatusProps {
  currentVersion: string;
  isIndustrialSkin: boolean;
}

const clampPercent = (percent: number | undefined): number =>
  Math.min(100, Math.max(0, Math.round(percent ?? 0)));

export const SidebarUpdateStatus: React.FC<SidebarUpdateStatusProps> = ({
  currentVersion,
  isIndustrialSkin,
}) => {
  const {
    status,
    info,
    progress,
    checkForUpdates,
    installUpdate,
  } = useElectronUpdater();
  const percent = clampPercent(progress?.percent);
  const version = info?.version;
  const mutedTextClass = isIndustrialSkin
    ? "text-[#9c9684]"
    : "text-slate-400 dark:text-slate-500";

  if (status === "downloaded") {
    return (
      <button
        type="button"
        onClick={installUpdate}
        aria-label={`Restartovat pro aktualizaci na verzi ${version ?? "novou"}`}
        className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          isIndustrialSkin
            ? "bg-[#b03a05] text-white hover:bg-[#8f2f04]"
            : "bg-primary text-white hover:brightness-110"
        }`}
      >
        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
          restart_alt
        </span>
        <span>Restartovat</span>
        <span className="size-1.5 rounded-full bg-white motion-safe:animate-pulse" aria-hidden="true" />
      </button>
    );
  }

  if (status === "downloading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-w-0 flex-1"
      >
        <div className={`flex items-center justify-between gap-2 text-[11px] ${mutedTextClass}`}>
          <span className="truncate">
            Aktualizuji{version ? ` na v${version}` : " aplikaci"}
          </span>
          <span className="shrink-0 font-mono tabular-nums">{percent} %</span>
        </div>
        <div
          role="progressbar"
          aria-label="Průběh stahování aktualizace"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className={`mt-1 h-1 overflow-hidden rounded-full ${
            isIndustrialSkin ? "bg-[rgba(20,16,8,0.10)]" : "bg-slate-200 dark:bg-slate-700"
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              isIndustrialSkin ? "bg-[#ff6a00]" : "bg-primary"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (status === "available") {
    return (
      <span role="status" aria-live="polite" className={`min-w-0 flex-1 truncate text-[11px] ${mutedTextClass}`}>
        Připravuji aktualizaci{version ? ` v${version}` : ""}…
      </span>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`truncate text-xs font-mono ${mutedTextClass}`}>v{currentVersion}</span>
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          aria-label="Zkusit aktualizaci znovu"
          title="Aktualizaci se nepodařilo dokončit. Zkuste kontrolu znovu."
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isIndustrialSkin
              ? "text-[#b03a05] hover:bg-[#ff8a33]/10"
              : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
          }`}
        >
          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
            sync_problem
          </span>
        </button>
      </div>
    );
  }

  return (
    <span className={`text-xs font-mono ${mutedTextClass}`}>
      v{currentVersion}
    </span>
  );
};

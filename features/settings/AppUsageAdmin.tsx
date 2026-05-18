import React, { useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  getAppUsageSummaryAdmin,
  type AppUsageSummaryItem,
} from "@features/settings/api";

const formatDuration = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 MB";
  const megabytes = bytes / 1024 / 1024;
  if (megabytes < 1024) return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
  return `${(megabytes / 1024).toFixed(1)} GB`;
};

const formatLastSeen = (value: string | null): string => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
};

const toCsvCell = (value: string | number | null): string => {
  const normalized = value === null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
};

const downloadCsv = (items: AppUsageSummaryItem[], daysBack: number): void => {
  const rows = [
    [
      "Organizace",
      "Uživatel",
      "Email",
      "Aktivní čas (s)",
      "Aktivní dny",
      "Relace",
      "Akce",
      "Vytvořené záznamy",
      "Upravené záznamy",
      "Smazané záznamy",
      "Nahraná data (B)",
      "Poslední aktivita",
    ],
    ...items.map((item) => [
      item.organizationName,
      item.displayName || "",
      item.email,
      item.activeSeconds,
      item.activeDays,
      item.sessionCount,
      item.actionCount,
      item.createdRecordsCount,
      item.updatedRecordsCount,
      item.deletedRecordsCount,
      item.uploadedBytes,
      item.lastSeenAt || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tender-flow-usage-${daysBack}d.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const AppUsageAdmin: React.FC = () => {
  const { showAlert } = useUI();
  const [daysBack, setDaysBack] = useState(30);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [items, setItems] = useState<AppUsageSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const organizations = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      map.set(item.organizationId, item.organizationName);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "cs"));
  }, [items]);

  const filteredItems = useMemo(
    () =>
      organizationFilter
        ? items.filter((item) => item.organizationId === organizationFilter)
        : items,
    [items, organizationFilter],
  );

  const totals = useMemo(
    () =>
      filteredItems.reduce(
        (acc, item) => ({
          activeSeconds: acc.activeSeconds + item.activeSeconds,
          sessionCount: acc.sessionCount + item.sessionCount,
          actionCount: acc.actionCount + item.actionCount,
          uploadedBytes: acc.uploadedBytes + item.uploadedBytes,
          activeUsers: acc.activeUsers + (item.activeSeconds > 0 || item.actionCount > 0 ? 1 : 0),
        }),
        {
          activeSeconds: 0,
          sessionCount: 0,
          actionCount: 0,
          uploadedBytes: 0,
          activeUsers: 0,
        },
      ),
    [filteredItems],
  );

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      const data = await getAppUsageSummaryAdmin(daysBack);
      setItems(data);
      setHasLoaded(true);
    } catch (error) {
      console.error("App usage summary load failed:", error);
      showAlert({
        title: "Načtení selhalo",
        message: "Statistiky využití aplikace se nepodařilo načíst.",
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">query_stats</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Využití aplikace
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Agregované metriky bez ukládání jednotlivých heartbeatů nebo obsahu práce.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Období
            <select
              value={daysBack}
              onChange={(event) => setDaysBack(Number(event.target.value))}
              className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none"
            >
              <option value={7}>Posledních 7 dní</option>
              <option value={30}>Posledních 30 dní</option>
              <option value={90}>Posledních 90 dní</option>
              <option value={365}>Posledních 365 dní</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 lg:min-w-[260px]">
            Organizace
            <select
              value={organizationFilter}
              onChange={(event) => setOrganizationFilter(event.target.value)}
              className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none"
            >
              <option value="">Všechny organizace s aktivitou</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button
              type="button"
              onClick={handleLoad}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[20px] ${isLoading ? "animate-spin" : ""}`}>
                {isLoading ? "sync" : "refresh"}
              </span>
              {isLoading ? "Načítám..." : "Načíst statistiky"}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(filteredItems, daysBack)}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Aktivní uživatelé</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totals.activeUsers}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Aktivní čas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatDuration(totals.activeSeconds)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Relace / akce</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totals.sessionCount} / {totals.actionCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Datový objem</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(totals.uploadedBytes)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40">
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Uživatel</th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Organizace</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Aktivní čas</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Dny</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Relace</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Akce</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Záznamy</th>
                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Data</th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase py-3 px-4">Poslední aktivita</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <span className="material-symbols-outlined animate-spin align-middle mr-2">sync</span>
                    Načítám statistiky...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    {hasLoaded ? "Pro zvolené období nejsou dostupná data." : "Načtěte statistiky pro vybrané období."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={`${item.organizationId}-${item.userId}`}
                    className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.displayName || item.email}
                        </span>
                        <span className="text-xs text-slate-500">{item.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{item.organizationName}</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatDuration(item.activeSeconds)}</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">{item.activeDays}</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">{item.sessionCount}</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">{item.actionCount}</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      +{item.createdRecordsCount} / ~{item.updatedRecordsCount} / -{item.deletedRecordsCount}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">{formatBytes(item.uploadedBytes)}</td>
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{formatLastSeen(item.lastSeenAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

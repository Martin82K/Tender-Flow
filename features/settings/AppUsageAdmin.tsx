import React, { useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import { ThemedSelect, type ThemedSelectOption } from "@shared/ui/ThemedSelect";
import {
  getAppUsageSummaryAdmin,
  type AppUsageSummaryItem,
} from "@features/settings/api";

const PERIOD_OPTIONS: ReadonlyArray<ThemedSelectOption<string>> = [
  { value: "7", label: "Posledních 7 dní" },
  { value: "30", label: "Posledních 30 dní" },
  { value: "90", label: "Posledních 90 dní" },
  { value: "365", label: "Posledních 365 dní" },
];

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
      "Stav měření",
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
      item.hasMeasuredUsage ? "Měřeno" : "Neměřeno",
      item.hasMeasuredUsage ? item.activeSeconds : "",
      item.hasMeasuredUsage ? item.activeDays : "",
      item.hasMeasuredUsage ? item.sessionCount : "",
      item.hasMeasuredUsage ? item.actionCount : "",
      item.hasMeasuredUsage ? item.createdRecordsCount : "",
      item.hasMeasuredUsage ? item.updatedRecordsCount : "",
      item.hasMeasuredUsage ? item.deletedRecordsCount : "",
      item.hasMeasuredUsage ? item.uploadedBytes : "",
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

  const organizationOptions = useMemo<ReadonlyArray<ThemedSelectOption<string>>>(
    () => [
      { value: "", label: "Všechny organizace" },
      ...organizations.map(([value, label]) => ({ value, label })),
    ],
    [organizations],
  );

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
        }),
        {
          activeSeconds: 0,
          sessionCount: 0,
          actionCount: 0,
          uploadedBytes: 0,
        },
      ),
    [filteredItems],
  );

  const userCounts = useMemo(() => {
    const allUserIds = new Set<string>();
    const activeUserIds = new Set<string>();
    const measuredUserIds = new Set<string>();

    filteredItems.forEach((item) => {
      allUserIds.add(item.userId);
      if (item.lastSeenAt) {
        activeUserIds.add(item.userId);
      }
      if (item.hasMeasuredUsage) measuredUserIds.add(item.userId);
    });

    return {
      active: activeUserIds.size,
      measured: measuredUserIds.size,
      total: allUserIds.size,
    };
  }, [filteredItems]);

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
          Agregované provozní metriky všech přihlášených uživatelů bez ukládání
          jednotlivých heartbeatů, vstupů nebo obsahu práce.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 lg:w-[220px]">
            <span>Období</span>
            <ThemedSelect
              ariaLabel="Období"
              value={String(daysBack)}
              options={PERIOD_OPTIONS}
              onChange={(value) => setDaysBack(Number(value))}
            />
          </div>

          <div className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 lg:min-w-[260px] lg:max-w-[360px]">
            <span>Organizace</span>
            <ThemedSelect
              ariaLabel="Organizace"
              value={organizationFilter}
              options={organizationOptions}
              onChange={setOrganizationFilter}
            />
          </div>

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
          <p className="text-xs font-bold uppercase text-slate-500">Uživatelé s aktivitou / celkem</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {userCounts.active} z {userCounts.total}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Měřený aktivní čas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatDuration(totals.activeSeconds)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Pokrytí {userCounts.measured} z {userCounts.total} uživatelů
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Měřené relace / akce</p>
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
                    <td className="py-3 px-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {item.hasMeasuredUsage ? formatDuration(item.activeSeconds) : "Neměřeno"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      {item.hasMeasuredUsage ? item.activeDays : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      {item.hasMeasuredUsage ? item.sessionCount : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      {item.hasMeasuredUsage ? item.actionCount : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      {item.hasMeasuredUsage
                        ? `+${item.createdRecordsCount} / ~${item.updatedRecordsCount} / -${item.deletedRecordsCount}`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">
                      {item.hasMeasuredUsage ? formatBytes(item.uploadedBytes) : "—"}
                    </td>
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

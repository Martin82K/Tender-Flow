import React, { useMemo, useState, useEffect } from "react";
import { useUI } from "@/context/UIContext";
import {
  getAppIncidentsAdmin,
  type IncidentAdminItem,
  purgeOldAppIncidentsAdmin,
} from "@/services/incidentAdminService";

const formatTs = (value: string): string => {
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
};

const normalizeDatetimeFilter = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

const readContextValue = (
  context: Record<string, unknown> | null | undefined,
  key: string,
): string => {
  const value = context?.[key];
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const IncidentLogsAdmin: React.FC = () => {
  const { showAlert, showConfirm } = useUI();
  const [incidentId, setIncidentId] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [actionOrCode, setActionOrCode] = useState("");
  const [fromTs, setFromTs] = useState("");
  const [toTs, setToTs] = useState("");
  const [retentionDays, setRetentionDays] = useState("60");
  const [displayLimitMode, setDisplayLimitMode] = useState<"auto" | "25" | "50" | "100" | "200">("auto");
  const [viewportHeight, setViewportHeight] = useState(
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [items, setItems] = useState<IncidentAdminItem[]>([]);
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const autoDisplayLimit = useMemo(() => {
    const estimatedRows = Math.floor((viewportHeight - 520) / 46);
    return clamp(estimatedRows, 10, 250);
  }, [viewportHeight]);

  const tableMaxHeight = useMemo(
    () => clamp(viewportHeight - 460, 280, 740),
    [viewportHeight],
  );

  const effectiveDisplayLimit = useMemo(() => {
    if (displayLimitMode === "auto") return autoDisplayLimit;
    return Number(displayLimitMode);
  }, [displayLimitMode, autoDisplayLimit]);

  const hasFilters = useMemo(
    () =>
      Boolean(incidentId.trim()) ||
      Boolean(userId.trim()) ||
      Boolean(userEmail.trim()) ||
      Boolean(actionOrCode.trim()) ||
      Boolean(fromTs.trim()) ||
      Boolean(toTs.trim()),
    [incidentId, userId, userEmail, actionOrCode, fromTs, toTs],
  );

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const data = await getAppIncidentsAdmin({
        incidentId: incidentId.trim() || undefined,
        userId: userId.trim() || undefined,
        userEmail: userEmail.trim() || undefined,
        actionOrCode: actionOrCode.trim() || undefined,
        fromTs: normalizeDatetimeFilter(fromTs),
        toTs: normalizeDatetimeFilter(toTs),
        limit: 500,
      });
      setItems(data);
      setExpandedIncidentId(null);
    } catch (error) {
      console.error("Incident logs load failed:", error);
      showAlert({
        title: "Načtení selhalo",
        message: "Incident logy se nepodařilo načíst.",
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const visibleItems = useMemo(
    () => items.slice(0, effectiveDisplayLimit),
    [items, effectiveDisplayLimit],
  );

  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length);

  const handlePurge = async () => {
    const days = clamp(Number(retentionDays) || 60, 7, 365);
    const confirmed = await showConfirm({
      title: "Smazat staré incident logy?",
      message: `Budou smazány incidenty starší než ${days} dnů. Akce je nevratná.`,
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });

    if (!confirmed) return;

    setIsPurging(true);
    try {
      const deletedCount = await purgeOldAppIncidentsAdmin(days);
      showAlert({
        title: "Mazání dokončeno",
        message: `Smazáno záznamů: ${deletedCount}.`,
        variant: "success",
      });
      if (items.length) {
        void handleSearch();
      }
    } catch (error) {
      console.error("Incident logs purge failed:", error);
      showAlert({
        title: "Mazání selhalo",
        message: "Staré incident logy se nepodařilo smazat.",
        variant: "danger",
      });
    } finally {
      setIsPurging(false);
    }
  };

  const handleCopyIncidentDetail = async (item: IncidentAdminItem) => {
    const payload = {
      ...item,
      context: item.context ?? {},
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showAlert({
        title: "Zkopírováno",
        message: "Detail incidentu byl zkopírován do schránky.",
        variant: "success",
      });
    } catch {
      showAlert({
        title: "Kopírování selhalo",
        message: "Detail incidentu se nepodařilo zkopírovat.",
        variant: "danger",
      });
    }
  };

  return (
    <section className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400">monitoring</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Incident logy
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Dohledání runtime chyb podle incident ID, uživatele a času.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="Incident ID (INC-...)"
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID (UUID)"
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="text"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="E-mail uživatele"
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="text"
            value={actionOrCode}
            onChange={(e) => setActionOrCode(e.target.value)}
            placeholder="Akce / kód / text"
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={fromTs}
            onChange={(e) => setFromTs(e.target.value)}
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={toTs}
            onChange={(e) => setToTs(e.target.value)}
            className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              void handleSearch();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isLoading ? "sync" : "search"}
            </span>
            {isLoading ? "Načítám..." : "Vyhledat incidenty"}
          </button>

          <button
            onClick={() => {
              setIncidentId("");
              setUserId("");
              setUserEmail("");
              setActionOrCode("");
              setFromTs("");
              setToTs("");
              setItems([]);
            }}
            disabled={!hasFilters && !items.length}
            className="px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vyčistit
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label
              htmlFor="incident-display-limit"
              className="text-xs font-medium text-slate-500 dark:text-slate-300"
            >
              Max zobrazení
            </label>
            <select
              id="incident-display-limit"
              value={displayLimitMode}
              onChange={(e) =>
                setDisplayLimitMode(e.target.value as "auto" | "25" | "50" | "100" | "200")
              }
              className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-2 py-2 text-xs text-slate-700 dark:text-white focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="auto">Auto ({autoDisplayLimit})</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/40 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="incident-retention-days"
              className="text-xs font-medium text-slate-500 dark:text-slate-300"
            >
              Smazat logy starší než (dny)
            </label>
            <input
              id="incident-retention-days"
              type="number"
              min={7}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-36 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              void handlePurge();
            }}
            disabled={isPurging}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-rose-300/50 dark:border-rose-800/60 text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPurging ? "Mažu..." : "Smazat staré logy"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/40 text-sm text-slate-500 flex items-center justify-between gap-2">
          <span>
            Zobrazeno: {visibleItems.length} / {items.length}
          </span>
          {hiddenItemsCount > 0 && (
            <span className="text-xs text-slate-400">
              {hiddenItemsCount} dalších záznamů je skryto kvůli limitu zobrazení.
            </span>
          )}
        </div>
        <div className="overflow-auto" style={{ maxHeight: tableMaxHeight }}>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10">
              <tr className="text-left text-slate-500 dark:text-slate-300">
                <th className="px-2 py-2 w-10">#</th>
                <th className="px-4 py-2">Čas</th>
                <th className="px-4 py-2">Incident ID</th>
                <th className="px-4 py-2">Sev</th>
                <th className="px-4 py-2">Kategorie</th>
                <th className="px-4 py-2">Kód</th>
                <th className="px-4 py-2">Akce</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Zpráva</th>
                <th className="px-4 py-2">Uživatel</th>
                <th className="px-4 py-2">Route</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const isExpanded = expandedIncidentId === item.id;
                const contextJson = (() => {
                  try {
                    return JSON.stringify(item.context ?? {}, null, 2);
                  } catch {
                    return "{}";
                  }
                })();
                const action = readContextValue(item.context, "action");
                const provider = readContextValue(item.context, "provider");
                const actionStatus = readContextValue(item.context, "action_status");
                const folderPath = readContextValue(item.context, "folder_path");
                const targetPath = readContextValue(item.context, "target_path");
                const projectId = readContextValue(item.context, "project_id");
                const entityType = readContextValue(item.context, "entity_type");
                const entityId = readContextValue(item.context, "entity_id");

                return (
                  <React.Fragment key={item.id}>
                    <tr className="border-t border-slate-100 dark:border-slate-800/70 text-slate-700 dark:text-slate-200">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIncidentId((prev) => (prev === item.id ? null : item.id))
                          }
                          className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800/60"
                          aria-label={`${isExpanded ? "Skrýt" : "Zobrazit"} detail incidentu ${item.incident_id}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isExpanded ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatTs(item.occurred_at)}</td>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                        {item.incident_id}
                      </td>
                      <td className="px-4 py-2 uppercase">{item.severity}</td>
                      <td className="px-4 py-2">{item.category}</td>
                      <td className="px-4 py-2 font-mono text-xs">{item.code}</td>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{action}</td>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{provider}</td>
                      <td className="px-4 py-2 max-w-[460px] truncate" title={item.message}>
                        {item.message}
                      </td>
                      <td className="px-4 py-2 text-xs min-w-[200px]">
                        <div className="font-medium text-slate-700 dark:text-slate-100">
                          {item.user_email || "-"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.user_id || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                        {item.route || "-"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-slate-100 dark:border-slate-800/70">
                        <td colSpan={11} className="px-4 py-4 bg-slate-50/60 dark:bg-slate-900/40">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              Detail incidentu {item.incident_id}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                void handleCopyIncidentDetail(item);
                              }}
                              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            >
                              Kopírovat JSON
                            </button>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            <div className="xl:col-span-2 space-y-3">
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-950/40">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                  Zpráva
                                </div>
                                <pre className="text-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
                                  {item.message}
                                </pre>
                              </div>
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-950/40">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                  Stack trace
                                </div>
                                <pre className="text-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 max-h-44 overflow-auto">
                                  {item.stack || "Není k dispozici."}
                                </pre>
                              </div>
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-950/40">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                  Kontext (JSON)
                                </div>
                                <pre className="text-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 max-h-44 overflow-auto">
                                  {contextJson}
                                </pre>
                              </div>
                            </div>

                            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-950/40">
                              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                Metadata
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Source:</strong> {item.source}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Platform:</strong> {item.platform}/{item.os}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Akce:</strong> {action}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Stav akce:</strong> {actionStatus}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Provider:</strong> {provider}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Release:</strong> {item.release_channel} ({item.app_version})
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Fingerprint:</strong> {item.fingerprint}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Session:</strong> {item.session_id}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Org:</strong> {item.organization_id || "-"}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Uživatel:</strong> {item.user_email || "-"}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Projekt:</strong> {projectId}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Entita:</strong> {entityType} / {entityId}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Složka:</strong> {folderPath}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Cíl:</strong> {targetPath}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                <strong>Ingested:</strong> {formatTs(item.ingested_at)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!items.length && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    Zatím žádné incidenty. Spusť vyhledání nebo zadej filtr.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default IncidentLogsAdmin;

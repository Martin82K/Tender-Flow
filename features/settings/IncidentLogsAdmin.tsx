import React, { useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  getAppIncidentsAdmin,
  type IncidentAdminItem,
} from "@/services/incidentAdminService";

const formatTs = (value: string): string => {
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
};

export const IncidentLogsAdmin: React.FC = () => {
  const { showAlert } = useUI();
  const [incidentId, setIncidentId] = useState("");
  const [userId, setUserId] = useState("");
  const [fromTs, setFromTs] = useState("");
  const [toTs, setToTs] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<IncidentAdminItem[]>([]);

  const hasFilters = useMemo(
    () =>
      Boolean(incidentId.trim()) ||
      Boolean(userId.trim()) ||
      Boolean(fromTs.trim()) ||
      Boolean(toTs.trim()),
    [incidentId, userId, fromTs, toTs],
  );

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const data = await getAppIncidentsAdmin({
        incidentId: incidentId.trim() || undefined,
        userId: userId.trim() || undefined,
        fromTs: fromTs.trim() || undefined,
        toTs: toTs.trim() || undefined,
        limit: 200,
      });
      setItems(data);
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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

        <div className="mt-4 flex items-center gap-3">
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
              setFromTs("");
              setToTs("");
              setItems([]);
            }}
            disabled={!hasFilters && !items.length}
            className="px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vyčistit
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/40 text-sm text-slate-500">
          Záznamů: {items.length}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-slate-500 dark:text-slate-300">
                <th className="px-4 py-2">Čas</th>
                <th className="px-4 py-2">Incident ID</th>
                <th className="px-4 py-2">Sev</th>
                <th className="px-4 py-2">Kategorie</th>
                <th className="px-4 py-2">Kód</th>
                <th className="px-4 py-2">Zpráva</th>
                <th className="px-4 py-2">Uživatel</th>
                <th className="px-4 py-2">Route</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 dark:border-slate-800/70 text-slate-700 dark:text-slate-200"
                >
                  <td className="px-4 py-2 whitespace-nowrap">{formatTs(item.occurred_at)}</td>
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                    {item.incident_id}
                  </td>
                  <td className="px-4 py-2 uppercase">{item.severity}</td>
                  <td className="px-4 py-2">{item.category}</td>
                  <td className="px-4 py-2 font-mono text-xs">{item.code}</td>
                  <td className="px-4 py-2 max-w-[460px] truncate" title={item.message}>
                    {item.message}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                    {item.user_id || "-"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                    {item.route || "-"}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td
                    colSpan={8}
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

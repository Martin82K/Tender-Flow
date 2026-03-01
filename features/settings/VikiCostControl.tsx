import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getUsageTenantsAdmin,
  type UsageTenantOption,
} from "@/services/featureUsageService";
import {
  getVikiCostDailyAdmin,
  getVikiCostModelsAdmin,
  getVikiCostOverviewAdmin,
  type VikiCostDailyItem,
  type VikiCostModelItem,
  type VikiCostOverview,
} from "@/features/settings/api/vikiCostService";

const DAY_OPTIONS = [7, 30, 90] as const;

const formatUsd = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

const formatInteger = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 0,
  }).format(value);

const formatHours = (seconds: number): string => {
  if (seconds <= 0) return "0 h";
  const hours = seconds / 3600;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)} h`;
};

const emptyOverview: VikiCostOverview = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  voiceTranscribeSeconds: 0,
  voiceTtsChars: 0,
};

export const VikiCostControl: React.FC = () => {
  const [tenants, setTenants] = useState<UsageTenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [daysBack, setDaysBack] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<VikiCostOverview>(emptyOverview);
  const [daily, setDaily] = useState<VikiCostDailyItem[]>([]);
  const [models, setModels] = useState<VikiCostModelItem[]>([]);

  useEffect(() => {
    let active = true;

    const loadTenants = async () => {
      try {
        const options = await getUsageTenantsAdmin();
        if (!active) return;
        setTenants(options);
        setSelectedTenantId((prev) => prev || options[0]?.organizationId || "");
      } catch (e) {
        if (!active) return;
        console.error("[VikiCostControl] failed to load tenants", e);
        setError("Nepodařilo se načíst seznam organizací.");
      }
    };

    void loadTenants();
    return () => {
      active = false;
    };
  }, []);

  const selectedTenantName = useMemo(
    () => tenants.find((item) => item.organizationId === selectedTenantId)?.organizationName || "-",
    [selectedTenantId, tenants],
  );

  const loadStats = useCallback(async () => {
    if (!selectedTenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [overviewResult, dailyResult, modelResult] = await Promise.all([
        getVikiCostOverviewAdmin(selectedTenantId, daysBack),
        getVikiCostDailyAdmin(selectedTenantId, daysBack),
        getVikiCostModelsAdmin(selectedTenantId, daysBack),
      ]);

      setOverview(overviewResult);
      setDaily(dailyResult);
      setModels(modelResult);
    } catch (e) {
      console.error("[VikiCostControl] failed to load stats", e);
      setError(
        "Nepodařilo se načíst Viki cost metriky. Zkontroluj nasazení migrace ai_agent_usage_events.",
      );
      setOverview(emptyOverview);
      setDaily([]);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [daysBack, selectedTenantId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">monitoring</span>
          Viki Cost Control
        </h3>
        <button
          type="button"
          onClick={() => {
            void loadStats();
          }}
          disabled={isLoading || !selectedTenantId}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {isLoading ? "Načítám..." : "Obnovit"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Organizace
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-slate-100"
          >
            {tenants.map((tenant) => (
              <option key={tenant.organizationId} value={tenant.organizationId}>
                {tenant.organizationName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Období
          <select
            value={String(daysBack)}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-slate-100"
          >
            {DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                Posledních {days} dní
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-slate-500 flex flex-col gap-1">
          Vybraná organizace
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            {selectedTenantName}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300/60 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="text-xs text-slate-500">Estimated spend</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatUsd(overview.estimatedCostUsd)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="text-xs text-slate-500">Total tokens</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatInteger(overview.totalTokens)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="text-xs text-slate-500">Voice transcribe</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatHours(overview.voiceTranscribeSeconds)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="text-xs text-slate-500">Voice TTS chars</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatInteger(overview.voiceTtsChars)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Nejdražší modely
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Model</th>
                  <th className="px-3 py-2 text-right">Requests</th>
                  <th className="px-3 py-2 text-right">Tokens</th>
                  <th className="px-3 py-2 text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {models.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={4}>
                      Zatím bez dat.
                    </td>
                  </tr>
                )}
                {models.map((item) => (
                  <tr key={item.model} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{item.model}</td>
                    <td className="px-3 py-2 text-right">{formatInteger(item.requests)}</td>
                    <td className="px-3 py-2 text-right">{formatInteger(item.totalTokens)}</td>
                    <td className="px-3 py-2 text-right">{formatUsd(item.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Denní trend
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Den</th>
                  <th className="px-3 py-2 text-right">Req</th>
                  <th className="px-3 py-2 text-right">Tokens</th>
                  <th className="px-3 py-2 text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={4}>
                      Zatím bez dat.
                    </td>
                  </tr>
                )}
                {daily.map((item) => (
                  <tr key={item.day} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{item.day}</td>
                    <td className="px-3 py-2 text-right">{formatInteger(item.requests)}</td>
                    <td className="px-3 py-2 text-right">{formatInteger(item.totalTokens)}</td>
                    <td className="px-3 py-2 text-right">{formatUsd(item.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VikiCostControl;

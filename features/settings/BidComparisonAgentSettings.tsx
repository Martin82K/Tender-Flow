import React, { useEffect, useMemo, useState } from "react";
import {
  BID_COMPARISON_AGENT_SETTINGS_KEY,
  DEFAULT_BID_COMPARISON_AGENT_TIMEOUT_MS,
  normalizeBidComparisonAgentConfig,
  parseBidComparisonAgentSettings,
} from "@/shared/bidComparisonAgentSettings";
import platformAdapter from "@/services/platformAdapter";
import type { BidComparisonAgentConfig } from "@/shared/types/desktop";

type SaveState = "idle" | "saving" | "saved" | "error";
type TestState = "idle" | "testing" | "success" | "error";

export const BidComparisonAgentSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://agent.kalmatech.cz");
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_BID_COMPARISON_AGENT_TIMEOUT_MS);
  const [savedBearerToken, setSavedBearerToken] = useState("");
  const [bearerTokenInput, setBearerTokenInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      const raw = await platformAdapter.storage.get(BID_COMPARISON_AGENT_SETTINGS_KEY);
      if (cancelled) return;
      const parsed = parseBidComparisonAgentSettings(raw);
      setEnabled(parsed.enabled);
      setBaseUrl(parsed.baseUrl);
      setTimeoutMs(parsed.timeoutMs ?? DEFAULT_BID_COMPARISON_AGENT_TIMEOUT_MS);
      setSavedBearerToken(parsed.bearerToken);
      setBearerTokenInput("");
    };

    void loadSettings().catch((error) => {
      if (cancelled) return;
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveConfig = useMemo<BidComparisonAgentConfig>(() => (
    normalizeBidComparisonAgentConfig({
      enabled,
      baseUrl,
      timeoutMs,
      bearerToken: bearerTokenInput.trim() || savedBearerToken,
    })
  ), [baseUrl, bearerTokenInput, enabled, savedBearerToken, timeoutMs]);

  const hasToken = effectiveConfig.bearerToken.length > 0;

  const saveSettings = async () => {
    setSaveState("saving");
    setMessage(null);

    if (enabled && !hasToken) {
      setSaveState("error");
      setMessage("Pro zapnutí agenta je nutné zadat API token.");
      return;
    }

    try {
      await platformAdapter.storage.set(
        BID_COMPARISON_AGENT_SETTINGS_KEY,
        JSON.stringify(effectiveConfig),
      );
      setSavedBearerToken(effectiveConfig.bearerToken);
      setBearerTokenInput("");
      setSaveState("saved");
      setMessage("Nastavení agenta bylo uloženo.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const testConnection = async () => {
    setTestState("testing");
    setMessage(null);

    if (!hasToken) {
      setTestState("error");
      setMessage("Pro test spojení je nutné zadat API token.");
      return;
    }

    try {
      const result = await platformAdapter.bidComparison.testAgent({
        ...effectiveConfig,
        enabled: true,
      });

      if (!result.success) {
        setTestState("error");
        setMessage(result.error || "Test Hermes agenta selhal.");
        return;
      }

      setTestState("success");
      setMessage(`Hermes agent odpověděl${result.status ? ` HTTP ${result.status}` : ""}.`);
    } catch (error) {
      setTestState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const clearToken = async () => {
    const nextConfig = normalizeBidComparisonAgentConfig({
      enabled: false,
      baseUrl,
      timeoutMs,
      bearerToken: "",
    });
    await platformAdapter.storage.set(
      BID_COMPARISON_AGENT_SETTINGS_KEY,
      JSON.stringify(nextConfig),
    );
    setEnabled(false);
    setSavedBearerToken("");
    setBearerTokenInput("");
    setSaveState("saved");
    setMessage("Token byl odstraněn a agent vypnut.");
  };

  return (
    <section className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">compare_arrows</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Porovnání nabídek</h2>
        </div>
        <p className="text-sm text-slate-500">Hermes agent pro položkové vyhodnocení jednotkových cen</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Agentní analýza</h3>
            <p className="text-sm text-slate-500">Doporučení se zapisuje do listu Agent doporučení v latest XLSX.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Zapnuto
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hermes URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              placeholder="https://agent.kalmatech.cz"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Timeout</span>
            <input
              type="number"
              min={5000}
              max={120000}
              step={1000}
              value={timeoutMs}
              onChange={(event) => setTimeoutMs(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">API token</span>
          <input
            value={bearerTokenInput}
            onChange={(event) => setBearerTokenInput(event.target.value)}
            type="password"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            placeholder={savedBearerToken ? "Uložený token zůstane zachován" : "Bearer token"}
          />
          <span className="text-xs text-slate-500">
            Stav tokenu: {hasToken ? "uložený nebo připravený k uložení" : "není nastavený"}
          </span>
        </label>

        {message && (
          <div className={`rounded-lg px-3 py-2 text-sm ${
            saveState === "error" || testState === "error"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {message}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saveState === "saving"}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saveState === "saving" ? "Ukládám..." : "Uložit nastavení"}
          </button>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testState === "testing"}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {testState === "testing" ? "Testuji..." : "Otestovat spojení"}
          </button>
          {hasToken && (
            <button
              type="button"
              onClick={() => void clearToken()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            >
              Odstranit token
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

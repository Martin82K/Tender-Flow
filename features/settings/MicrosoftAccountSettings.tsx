import React, { useCallback, useEffect, useState } from "react";

import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";

type IdentityState = {
  available: boolean;
  linked: boolean;
  email: string | null;
};

export const MicrosoftAccountSettings: React.FC = () => {
  const [graphConnected, setGraphConnected] = useState(false);
  const [identity, setIdentity] = useState<IdentityState>({
    available: false,
    linked: false,
    email: null,
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      await microsoftAccountService.completeMicrosoftAccountConnection();
      const [graphResult, identityResult, todoResult] = await Promise.allSettled([
        microsoftAccountService.getGraphStatus(),
        microsoftAccountService.getLoginIdentity(),
        microsoftAccountService.getTodoStatus(),
      ]);
      if (identityResult.status === "rejected") throw identityResult.reason;
      setIdentity(identityResult.value);
      if (graphResult.status === "rejected") throw graphResult.reason;
      setGraphConnected(graphResult.value.connected);
      if (todoResult.status === "rejected") throw todoResult.reason;
      setError(todoResult.value.syncError);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microsoft připojení se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microsoft operace se nezdařila.");
    } finally {
      setPending(false);
    }
  };

  const fullyConnected = identity.linked && graphConnected;

  const handlePrimaryAction = () => {
    void run(microsoftAccountService.connectMicrosoftAccount);
  };

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <span className="material-symbols-outlined text-emerald-500">account_circle</span>
        Microsoft účet
      </h2>
      <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
        Propojte svůj pracovní Microsoft účet pro přihlášení, online dokumenty a synchronizaci Microsoft To Do.
      </p>

      {error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={`text-sm font-semibold ${fullyConnected ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>
              {fullyConnected ? "Microsoft účet je propojený" : "Propojení Microsoft účtu"}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {fullyConnected
                ? "Účet lze používat pro přihlášení, online dokumenty i Microsoft To Do."
                : identity.linked
                  ? "Jedním přihlášením obnovíte přístup ke všem funkcím povoleným pro Tender Flow."
                  : "Jedno přihlášení na stránce Microsoftu povolí všechny funkce schválené správcem tenantu."}
            </p>
            {identity.linked && identity.email ? (
              <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{identity.email}</div>
            ) : null}
            {!identity.available && !identity.linked && !loading ? (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">Microsoft přihlášení zatím není správcem aktivováno.</div>
            ) : null}
          </div>

          {!fullyConnected ? (
            <button
              type="button"
              disabled={loading || pending || (!identity.linked && !identity.available)}
              onClick={handlePrimaryAction}
              className="shrink-0 rounded-lg border border-emerald-300/50 bg-emerald-400 px-4 py-2 text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400/30 dark:bg-emerald-400 dark:hover:bg-emerald-300"
            >
              {pending ? "Propojuji…" : "Propojit Microsoft účet"}
            </button>
          ) : null}
        </div>

        <details className="mt-4 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400">
            Co propojení zahrnuje
          </summary>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Tender Flow použije pouze funkce Microsoft Graph, které jsou pro aplikaci schválené ve vašem tenantu: přihlášení, práci s online dokumenty a synchronizaci Microsoft To Do.
          </p>
        </details>

        {identity.linked || graphConnected ? (
          <details className="mt-4 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Spravovat propojení</summary>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Odpojením se zruší jednotný Graph přístup k dokumentům i Microsoft To Do. Přihlášení zůstane jen tehdy, pokud je jediným způsobem přístupu k účtu.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {identity.linked || graphConnected ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(microsoftAccountService.disconnectMicrosoftAccount)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pending ? "Odpojuji…" : "Odpojit Microsoft účet"}
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
};

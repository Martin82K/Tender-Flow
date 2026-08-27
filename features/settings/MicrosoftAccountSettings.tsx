import React, { useCallback, useEffect, useState } from "react";

import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";

type IdentityState = {
  available: boolean;
  linked: boolean;
  email: string | null;
};

const isLegacyProjectStatusError = (cause: unknown): boolean =>
  cause instanceof Error && cause.message.toLowerCase().includes("missing projectid");

export const MicrosoftAccountSettings: React.FC = () => {
  const [documentsConnected, setDocumentsConnected] = useState(false);
  const [todoConnected, setTodoConnected] = useState(false);
  const [todoLastSyncedAt, setTodoLastSyncedAt] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityState>({
    available: false,
    linked: false,
    email: null,
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"documents" | "identity" | "todo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      let todoSyncError: string | null = null;
      const [documentsResult, identityResult, todoResult] = await Promise.allSettled([
        microsoftAccountService.getStatus(),
        microsoftAccountService.getLoginIdentity(),
        microsoftAccountService.getTodoStatus(),
      ]);
      if (identityResult.status === "rejected") throw identityResult.reason;
      setIdentity(identityResult.value);
      if (documentsResult.status === "fulfilled") {
        setDocumentsConnected(documentsResult.value.connected);
      } else if (isLegacyProjectStatusError(documentsResult.reason)) {
        setDocumentsConnected(false);
      } else {
        throw documentsResult.reason;
      }
      if (todoResult.status === "fulfilled") {
        setTodoConnected(todoResult.value.connected);
        setTodoLastSyncedAt(todoResult.value.lastSyncedAt);
        todoSyncError = todoResult.value.syncError;
      } else {
        throw todoResult.reason;
      }
      setError(todoSyncError);
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

  const run = async (kind: "documents" | "identity" | "todo", action: () => Promise<void>) => {
    setPending(kind);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microsoft operace se nezdařila.");
    } finally {
      setPending(null);
    }
  };

  const fullyConnected = identity.linked && documentsConnected && todoConnected;
  const primaryKind = !identity.linked
    ? "identity"
    : !documentsConnected
      ? "documents"
      : !todoConnected
        ? "todo"
        : null;
  const primaryLabel = !identity.linked
    ? "Propojit Microsoft účet"
    : !documentsConnected
      ? "Dokončit připojení dokumentů"
      : "Připojit Microsoft To Do";

  const handlePrimaryAction = () => {
    if (primaryKind === "identity") {
      void run("identity", microsoftAccountService.linkLoginIdentity);
      return;
    }
    if (primaryKind === "documents") {
      void run("documents", microsoftAccountService.connectDocumentAccess);
      return;
    }
    if (primaryKind === "todo") {
      void run("todo", microsoftAccountService.connectTodoAccess);
    }
  };

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <span className="material-symbols-outlined text-blue-600">account_circle</span>
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
                : todoConnected
                  ? "Microsoft To Do je připojené. Dokončete zbývající části propojení."
                  : identity.linked
                    ? documentsConnected
                      ? "Přihlášení a dokumenty jsou připravené. Zbývá povolit Microsoft To Do."
                      : "Přihlášení je připravené. Zbývá povolit čtení dokumentů a Microsoft To Do."
                  : "Tender Flow vás provede bezpečným přihlášením na stránce Microsoftu."}
            </p>
            {identity.linked && identity.email ? (
              <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{identity.email}</div>
            ) : null}
            {!identity.available && !identity.linked && !loading ? (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">Microsoft přihlášení zatím není správcem aktivováno.</div>
            ) : null}
          </div>

          {primaryKind ? (
            <button
              type="button"
              disabled={loading || pending !== null || (primaryKind === "identity" && !identity.available)}
              onClick={handlePrimaryAction}
              className="shrink-0 rounded-lg border border-blue-500/30 bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Ověřuji…" : primaryLabel}
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <span className={`material-symbols-outlined text-base ${identity.linked ? "text-emerald-600" : "text-slate-400"}`}>
              {identity.linked ? "check_circle" : "radio_button_unchecked"}
            </span>
            Přihlašování {identity.linked ? "propojeno" : "čeká na propojení"}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <span className={`material-symbols-outlined text-base ${documentsConnected ? "text-emerald-600" : "text-slate-400"}`}>
              {documentsConnected ? "check_circle" : "radio_button_unchecked"}
            </span>
            Online dokumenty {documentsConnected ? "povoleny" : "čekají na povolení"}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <span className={`material-symbols-outlined text-base ${todoConnected ? "text-emerald-600" : "text-slate-400"}`}>
              {todoConnected ? "check_circle" : "radio_button_unchecked"}
            </span>
            <span>
              Microsoft To Do {todoConnected ? "synchronizováno" : "čeká na povolení"}
              {todoConnected && todoLastSyncedAt ? (
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {new Date(todoLastSyncedAt).toLocaleString("cs-CZ")}
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {identity.linked || documentsConnected || todoConnected ? (
          <details className="mt-4 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Spravovat propojení</summary>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Přihlašování a přístup k dokumentům lze z bezpečnostních důvodů odvolat samostatně.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {documentsConnected ? (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void run("documents", microsoftAccountService.disconnectDocumentAccess)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pending === "documents" ? "Odpojuji…" : "Odpojit dokumenty"}
                </button>
              ) : null}
              {todoConnected ? (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void run("todo", microsoftAccountService.disconnectTodoAccess)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pending === "todo" ? "Odpojuji…" : "Odpojit Microsoft To Do"}
                </button>
              ) : null}
              {identity.linked ? (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void run("identity", microsoftAccountService.unlinkLoginIdentity)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pending === "identity" ? "Odebírám…" : "Odebrat napárování"}
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
};

import React, { useCallback, useEffect, useState } from "react";
import {
  listMyMcpClientGrants,
  revokeMyMcpClientAccess,
  setMyMcpClientGrant,
  type McpClientGrant,
  type McpElevatedPermission,
} from "@/features/settings/api/mcpGrantService";

const isActive = (expiresAt: string | null): boolean =>
  expiresAt === "infinity" || Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());

const formatExpiry = (expiresAt: string | null): string => {
  if (!expiresAt) return "není povoleno";
  if (expiresAt === "infinity") return "do odvolání";
  const value = new Date(expiresAt);
  if (Number.isNaN(value.getTime())) return "neplatný čas expirace";
  return value.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
};

export const McpAccessSettings: React.FC = () => {
  const [clients, setClients] = useState<McpClientGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingDisconnectClientId, setPendingDisconnectClientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClients(await listMyMcpClientGrants());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeGrant = async (
    clientId: string,
    permission: McpElevatedPermission,
    enabled: boolean,
  ) => {
    const key = `${clientId}:${permission}`;
    setSavingKey(key);
    setError(null);
    try {
      await setMyMcpClientGrant(clientId, permission, enabled);
      await load();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : String(changeError));
    } finally {
      setSavingKey(null);
    }
  };

  const disconnectClient = async (clientId: string) => {
    const key = `${clientId}:disconnect`;
    setSavingKey(key);
    setError(null);
    try {
      await revokeMyMcpClientAccess(clientId);
      setPendingDisconnectClientId(null);
      await load();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : String(disconnectError));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-6" data-help-id="settings-mcp-access">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-violet-500">hub</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI a MCP přístupy</h2>
        </div>
        <p className="max-w-3xl text-sm text-slate-500">
          Vyberte, co smí připojená AI dělat. Přístup vždy respektuje vaše práva ke stavbám.
        </p>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Nové připojení má zápis předvolený. Pokud stávající AI nabízí jen čtení, zapněte
        u ní zápis a potom v AI obnovte seznam nástrojů připojení.
      </p>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Načítám registrované MCP klienty…</p>}

      {!isLoading && clients.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Zatím nemáte připojenou žádnou AI. Připojení spusťte v aplikaci svého AI asistenta.
        </div>
      )}

      <div className="space-y-4">
        {clients.map((client) => {
          const contactsActive = isActive(client.contactsReadExpiresAt);
          const writeActive = isActive(client.writeExpiresAt);
          const bidOfferWriteActive = isActive(client.bidOfferWriteExpiresAt);
          const disconnectKey = `${client.clientId}:disconnect`;

          return (
            <article
              key={client.clientId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{client.clientName}</h3>
                  {client.clientUri && (
                    <p className="mt-1 break-all text-xs text-slate-500">{client.clientUri}</p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{client.clientId}</p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Základní čtení aktivní
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
                {([
                  { permission: "tenderflow.write", label: "Zápisové operace", active: writeActive, expiry: client.writeExpiresAt, description: "Úkoly a stav nabídek po vašem potvrzení; propojení zpráv Outlooku.", disabled: false },
                  { permission: "tenderflow.contacts.read", label: "Kontaktní údaje", active: contactsActive, expiry: client.contactsReadExpiresAt, description: "Kontakty a detail nabídek dodavatelů. Platnost 30 dní.", disabled: false },
                  { permission: "tenderflow.bids.offer.write", label: "Zápis ceny nabídky", active: bidOfferWriteActive, expiry: client.bidOfferWriteExpiresAt, description: "Cena bez DPH a podmínky nabídky po vašem potvrzení.", disabled: !writeActive && !bidOfferWriteActive },
                ] satisfies Array<{ permission: McpElevatedPermission; label: string; active: boolean; expiry: string | null; description: string; disabled: boolean }>).map((option) => (
                  <div key={option.permission} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{option.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {option.active ? `Zapnuto · ${formatExpiry(option.expiry)}` : option.disabled ? "Nejprve zapněte zápisové operace." : "Vypnuto"}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label={option.label}
                      aria-checked={option.active}
                      disabled={savingKey !== null || option.disabled}
                      onClick={() => void changeGrant(client.clientId, option.permission, !option.active)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-wait disabled:opacity-50 ${option.active ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"}`}
                    >
                      <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${option.active ? "left-0.5 translate-x-5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                {pendingDisconnectClientId === client.clientId ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                    <p className="font-semibold">Opravdu odpojit tohoto klienta?</p>
                    <p className="mt-1">
                      Odpojení zneplatní jeho aktivní relace a obnovovací tokeny. Pro další přístup bude
                      klient vyžadovat nové přihlášení a váš nový souhlas.
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">{client.clientId}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingKey === disconnectKey}
                        onClick={() => void disconnectClient(client.clientId)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Potvrdit odpojení
                      </button>
                      <button
                        type="button"
                        disabled={savingKey === disconnectKey}
                        onClick={() => setPendingDisconnectClientId(null)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold"
                      >
                        Zrušit
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={savingKey !== null}
                    onClick={() => {
                      setPendingDisconnectClientId(client.clientId);
                    }}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Odpojit klienta
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

import React, { useCallback, useEffect, useState } from "react";
import {
  listMyMcpClientGrants,
  revokeMyMcpClientAccess,
  setMyMcpClientGrant,
  type McpClientGrant,
  type McpElevatedPermission,
} from "@/features/settings/api/mcpGrantService";
import { McpToolMatrix } from "@/features/settings/components/McpToolMatrix";

const isActive = (expiresAt: string | null): boolean =>
  Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());

const formatExpiry = (expiresAt: string | null): string => {
  if (!expiresAt) return "není povoleno";
  const value = new Date(expiresAt);
  if (Number.isNaN(value.getTime())) return "neplatný čas expirace";
  return value.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
};

export const McpAccessSettings: React.FC = () => {
  const [clients, setClients] = useState<McpClientGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingWriteClientId, setPendingWriteClientId] = useState<string | null>(null);
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
      setPendingWriteClientId(null);
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
      setPendingWriteClientId(null);
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
          Správa oprávnění, která Tender Flow přidělí konkrétnímu OAuth klientovi po vašem přihlášení.
          Oprávnění nikdy nerozšiřují přístup nad vaše role, projektové členství a databázové RLS.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        Kontaktní údaje se povolují nejvýše na 30 dní. Zápis je záměrně krátkodobý – 8 hodin – a každý
        zápis stále vyžaduje prepare/confirm/execute potvrzení, audit a běžná oprávnění Tender Flow.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Načítám registrované MCP klienty…</p>}

      {!isLoading && clients.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Není dostupný žádný aktivní MCP OAuth klient. Zkontrolujte registraci klienta v provozním runbooku.
        </div>
      )}

      <div className="space-y-4">
        {clients.map((client) => {
          const contactsActive = isActive(client.contactsReadExpiresAt);
          const writeActive = isActive(client.writeExpiresAt);
          const contactsKey = `${client.clientId}:tenderflow.contacts.read`;
          const writeKey = `${client.clientId}:tenderflow.write`;
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

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Kontaktní údaje</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    E-maily, telefony a detail nabídek v rozsahu vašich oprávnění.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {contactsActive ? `Platí do ${formatExpiry(client.contactsReadExpiresAt)}` : "Není povoleno"}
                  </p>
                  <button
                    type="button"
                    disabled={savingKey === contactsKey}
                    onClick={() => void changeGrant(
                      client.clientId,
                      "tenderflow.contacts.read",
                      !contactsActive,
                    )}
                    className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {contactsActive ? "Odebrat kontaktní údaje" : "Povolit kontaktní údaje"}
                  </button>
                </div>

                <div className="rounded-lg border border-amber-200 p-4 dark:border-amber-500/30">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Zápisové operace</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Příprava, potvrzení a provedení podporovaných změn přes auditovaný protokol.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {writeActive ? `Platí do ${formatExpiry(client.writeExpiresAt)}` : "Není povoleno"}
                  </p>

                  {!writeActive && pendingWriteClientId === client.clientId ? (
                    <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                      <p>Každý zápis stále vyžaduje prepare/confirm/execute a může změnit vaše data.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={savingKey === writeKey}
                          onClick={() => void changeGrant(client.clientId, "tenderflow.write", true)}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          Potvrdit zápis na 8 hodin
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingWriteClientId(null)}
                          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold"
                        >
                          Zrušit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={savingKey === writeKey}
                      onClick={() => {
                        if (writeActive) {
                          void changeGrant(client.clientId, "tenderflow.write", false);
                        } else {
                          setPendingWriteClientId(client.clientId);
                        }
                      }}
                      className="mt-4 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
                    >
                      {writeActive ? "Odebrat zápis" : "Povolit zápis"}
                    </button>
                  )}
                </div>
              </div>

              <McpToolMatrix contactsActive={contactsActive} writeActive={writeActive} />

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
                    onClick={() => {
                      setPendingWriteClientId(null);
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

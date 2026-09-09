import React, { useEffect, useMemo, useRef, useState } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import {
  approveMcpOAuthAuthorization,
  denyMcpOAuthAuthorization,
  getMcpOAuthAuthorizationDetails,
  type McpOAuthConsentDetails,
} from "@/infra/auth/mcpOAuthConsentService";
import { navigate } from "@/shared/routing/router";
import { buildAppUrl } from "@/shared/routing/routeUtils";
import { setMyMcpClientGrant, type McpElevatedPermission } from "@/features/settings/api/mcpGrantService";

const permissionChoices: ReadonlyArray<{ permission: McpElevatedPermission; label: string; description: string }> = [
  { permission: "tenderflow.contacts.read", label: "Povolit kontaktní údaje na 30 dní", description: "Kontakty a detail dodavatelských nabídek v rozsahu vašich práv." },
  { permission: "tenderflow.write", label: "Povolit zápisové operace", description: "Do odvolání: vytváření úkolů a změny stavu nabídek po potvrzení. Propojení Outlook zprávy ukládá jen identifikátory." },
  { permission: "tenderflow.bids.offer.write", label: "Povolit zápis ceny nabídky", description: "Do odvolání: cena bez DPH v CZK a doplnění podmínek nabídky po potvrzení. Vyžaduje také zápisové operace." },
];

const scopeLabel = (scope: string): string => {
  switch (scope) {
    case "openid":
      return "ověření identity";
    case "email":
      return "e-mail uživatele";
    case "profile":
      return "základní profil";
    case "phone":
      return "telefonní číslo uživatele";
    case "offline_access":
      return "obnovení přístupu bez opakovaného přihlášení";
    default:
      return scope;
  }
};

const supportedOAuthScopes = new Set([
  "openid",
  "email",
  "profile",
  "phone",
  "offline_access",
]);

const getAuthorizationIdFromSearch = (search: string): string => {
  const params = new URLSearchParams(search);
  const direct = params.get("authorization_id");
  if (direct) return direct;

  const next = params.get("next");
  if (!next) return "";

  try {
    const decodedNext = decodeURIComponent(next);
    const nextUrl = new URL(decodedNext, window.location.origin);
    return nextUrl.searchParams.get("authorization_id") || "";
  } catch {
    return "";
  }
};

export const getOAuthRedirectUrl = (data?: { redirect_to?: string; redirect_url?: string } | null): string =>
  data?.redirect_to || data?.redirect_url || "";

export const McpOAuthConsentPage: React.FC = () => {
  const authorizationId = getAuthorizationIdFromSearch(window.location.search);
  const [details, setDetails] = useState<McpOAuthConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<McpElevatedPermission[]>(["tenderflow.write"]);
  const [approvedRedirect, setApprovedRedirect] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const clientId = details?.client?.id || details?.client?.client_id;
  const mcpSettingsUrl = buildAppUrl("settings", {
    settingsTab: "tools",
    settingsSubTab: "mcp",
  });

  const scopes = useMemo(
    () =>
      (details?.scope || "")
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter((scope) => supportedOAuthScopes.has(scope)),
    [details?.scope],
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!authorizationId) {
        setError("Chybí authorization_id pro OAuth schválení.");
        setIsLoading(false);
        return;
      }

      let response;
      try {
        response = await getMcpOAuthAuthorizationDetails(authorizationId);
      } catch {
        if (isMounted) {
          setError("Žádost se nepodařilo načíst. Obnovte stránku a zkuste to znovu.");
          setIsLoading(false);
        }
        return;
      }
      const { data, error: authError } = response;
      if (!isMounted) return;
      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }
      const redirectUrl = getOAuthRedirectUrl(data);
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setDetails(data);
      setIsLoading(false);
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    if (!authorizationId || submittingRef.current) return;
    if (approve && selectedPermissions.length > 0 && !clientId) {
      setError("Chybí identifikátor klienta pro udělení oprávnění. Připojení spusťte znovu.");
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      let redirectUrl = approvedRedirect;
      if (!redirectUrl) {
        const response = approve
          ? await approveMcpOAuthAuthorization(authorizationId)
          : await denyMcpOAuthAuthorization(authorizationId);
        if (response.error) throw new Error(response.error.message);
        redirectUrl = getOAuthRedirectUrl(response.data);
        if (!redirectUrl) throw new Error("OAuth server nevrátil redirect URL.");
        // Retain the callback only in memory: retry grants without consuming the OAuth request again.
        if (approve) setApprovedRedirect(redirectUrl);
      }
      if (approve && clientId) {
        for (const permission of selectedPermissions) {
          const result = await setMyMcpClientGrant(clientId, permission, true);
          if (!result.enabled || result.permission !== permission || !result.expiresAt) {
            throw new Error("Server nepotvrdil udělení vybraného oprávnění.");
          }
        }
      }
      window.location.assign(redirectUrl);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Přístup se nepodařilo dokončit. Zkuste to znovu.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-lg border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Připojit AI k Tender Flow</h1>
            <p className="mt-2 text-sm text-white/70">
              Schvalujete přístup MCP klienta k datům vašeho účtu Tender Flow.
            </p>
          </div>

          {isLoading && <p className="text-sm text-white/70">Načítám žádost o oprávnění...</p>}

          {!isLoading && error && (
            <div role="alert" className="mb-4 rounded-md border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              {error}
              {approvedRedirect && <p className="mt-2">Připojení je schválené, ale vybraná oprávnění se nepodařilo dokončit. Zkuste jejich uložení znovu; již udělená oprávnění zůstávají aktivní.</p>}
            </div>
          )}

          {!isLoading && details && (
            <div className="space-y-5">
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Aplikace</p>
                <p className="mt-1 text-base font-semibold text-white">
                  {details.client?.name || "Neznámý MCP klient"}
                </p>
                {details.client?.uri && (
                  <p className="mt-1 break-all text-xs text-white/60">{details.client.uri}</p>
                )}
              </div>

              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">OAuth identita</p>
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {scopes.length > 0 ? (
                    scopes.map((scope) => <li key={scope}>- {scopeLabel(scope)}</li>)
                  ) : (
                    <li>- základní přístup OAuth klienta</li>
                  )}
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Oprávnění v Tender Flow</p>
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  <li>- čtení projektů, výběrových řízení, smluv, plánů a termínů v rozsahu vašich oprávnění</li>
                  <li>- Kontaktní údaje a zápis vyžadují váš samostatný souhlas níže nebo v nastavení.</li>
                </ul>
              </div>

              <fieldset disabled={isSubmitting || Boolean(approvedRedirect)} className="space-y-3 rounded-md border border-white/10 bg-black/20 p-4">
                <legend className="px-1 text-sm font-semibold text-white">Volitelná oprávnění</legend>
                {permissionChoices.map(({ permission, label, description }) => (
                  <label key={permission} className="flex items-start gap-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={selectedPermissions.includes(permission)}
                      disabled={!clientId || (permission === "tenderflow.bids.offer.write" && !selectedPermissions.includes("tenderflow.write"))}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setSelectedPermissions((current) => enabled
                          ? permissionChoices.map((choice) => choice.permission).filter((value) => value === permission || current.includes(value))
                          : current.filter((value) => value !== permission && !(permission === "tenderflow.write" && value === "tenderflow.bids.offer.write")));
                      }}
                      className="mt-1 accent-white"
                    />
                    <span><span className="block font-semibold text-white">{label}</span><span className="mt-1 block text-xs text-white/70">{description}</span></span>
                  </label>
                ))}
              </fieldset>

              <div className="rounded-md border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                Zápisové operace jsou předvolené a povolíte je schválením připojení.
                Pokud chcete jen čtení, zápis před schválením vypněte.
                Dříve udělená oprávnění tím neodeberete. Přístup nikdy nepřekročí vaše role a práva ke stavbám.
                Oprávnění můžete kdykoliv změnit v nastavení AI a MCP přístupů.
              </div>

              <a
                href={mcpSettingsUrl}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(mcpSettingsUrl);
                }}
                className="inline-flex text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                Zobrazit správu MCP oprávnění
              </a>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => decide(true)}
                  className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-white/90 disabled:opacity-60"
                >
                  {approvedRedirect ? "Znovu uložit oprávnění" : "Schválit přístup"}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || Boolean(approvedRedirect)}
                  onClick={() => decide(false)}
                  className="flex-1 rounded-md border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  Zamítnout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

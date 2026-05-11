import React, { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import {
  approveMcpOAuthAuthorization,
  denyMcpOAuthAuthorization,
  getMcpOAuthAuthorizationDetails,
  type McpOAuthConsentDetails,
} from "@/infra/auth/mcpOAuthConsentService";

const scopeLabel = (scope: string): string => {
  switch (scope) {
    case "openid":
      return "ověření identity";
    case "email":
      return "e-mail uživatele";
    case "profile":
      return "základní profil";
    default:
      return scope;
  }
};

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

export const McpOAuthConsentPage: React.FC = () => {
  const authorizationId = getAuthorizationIdFromSearch(window.location.search);
  const [details, setDetails] = useState<McpOAuthConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scopes = useMemo(
    () =>
      (details?.scope || "")
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
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

      const { data, error: authError } = await getMcpOAuthAuthorizationDetails(authorizationId);
      if (!isMounted) return;
      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }
      if (data?.redirect_url) {
        window.location.assign(data.redirect_url);
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
    if (!authorizationId) return;
    setIsSubmitting(true);
    setError(null);
    const response = approve
      ? await approveMcpOAuthAuthorization(authorizationId)
      : await denyMcpOAuthAuthorization(authorizationId);

    if (response.error) {
      setError(response.error.message);
      setIsSubmitting(false);
      return;
    }

    if (response.data?.redirect_url) {
      window.location.assign(response.data.redirect_url);
      return;
    }

    setError("OAuth server nevrátil redirect URL.");
    setIsSubmitting(false);
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
            <div className="mb-4 rounded-md border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              {error}
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
                <p className="text-xs uppercase tracking-wide text-white/50">Požadovaný přístup</p>
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {scopes.length > 0 ? (
                    scopes.map((scope) => <li key={scope}>- {scopeLabel(scope)}</li>)
                  ) : (
                    <li>- základní přístup OAuth klienta</li>
                  )}
                </ul>
              </div>

              <div className="rounded-md border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                AI bude moct číst data, která mu MCP nástroje zpřístupní. Zápisy v Tender Flow vyžadují
                samostatné potvrzení přes návrh, přesnou potvrzovací větu a jednorázový token.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => decide(true)}
                  className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-white/90 disabled:opacity-60"
                >
                  Schválit přístup
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
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

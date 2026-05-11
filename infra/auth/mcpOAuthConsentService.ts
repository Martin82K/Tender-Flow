import { supabase } from "@/services/supabase";

export interface McpOAuthConsentDetails {
  authorization_id: string;
  redirect_url?: string;
  client?: {
    client_id?: string;
    name?: string;
    uri?: string;
    logo_uri?: string;
  };
  user?: {
    id: string;
    email?: string;
  };
  scope?: string;
}

interface OAuthResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

interface SupabaseOAuthApi {
  getAuthorizationDetails: (authorizationId: string) => Promise<OAuthResponse<McpOAuthConsentDetails>>;
  approveAuthorization: (
    authorizationId: string,
    options: { skipBrowserRedirect: true },
  ) => Promise<OAuthResponse<{ redirect_url?: string }>>;
  denyAuthorization: (
    authorizationId: string,
    options: { skipBrowserRedirect: true },
  ) => Promise<OAuthResponse<{ redirect_url?: string }>>;
}

const getOAuthApi = (): SupabaseOAuthApi => {
  const oauth = (supabase.auth as unknown as { oauth?: SupabaseOAuthApi }).oauth;
  if (!oauth) {
    throw new Error("Supabase OAuth server API is not available in this client.");
  }
  return oauth;
};

export const getMcpOAuthAuthorizationDetails = async (
  authorizationId: string,
): Promise<OAuthResponse<McpOAuthConsentDetails>> =>
  getOAuthApi().getAuthorizationDetails(authorizationId);

export const approveMcpOAuthAuthorization = async (
  authorizationId: string,
): Promise<OAuthResponse<{ redirect_url?: string }>> =>
  getOAuthApi().approveAuthorization(authorizationId, { skipBrowserRedirect: true });

export const denyMcpOAuthAuthorization = async (
  authorizationId: string,
): Promise<OAuthResponse<{ redirect_url?: string }>> =>
  getOAuthApi().denyAuthorization(authorizationId, { skipBrowserRedirect: true });

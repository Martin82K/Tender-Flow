import { dbAdapter } from "@/services/dbAdapter";

export type McpElevatedPermission =
  | "tenderflow.contacts.read"
  | "tenderflow.write";

interface McpClientGrantRow {
  client_id: string;
  client_name: string | null;
  client_uri: string | null;
  contacts_read_expires_at: string | null;
  write_expires_at: string | null;
}

interface McpGrantMutationRow {
  permission: McpElevatedPermission;
  enabled: boolean;
  expires_at: string | null;
}

export interface McpClientGrant {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  contactsReadExpiresAt: string | null;
  writeExpiresAt: string | null;
}

export interface McpGrantMutationResult {
  permission: McpElevatedPermission;
  enabled: boolean;
  expiresAt: string | null;
}

const throwRpcError = (error: unknown): never => {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Operaci MCP oprávnění se nepodařilo dokončit.";
  throw new Error(message);
};

export const listMyMcpClientGrants = async (): Promise<McpClientGrant[]> => {
  const { data, error } = await dbAdapter.rpc<McpClientGrantRow[]>(
    "list_my_mcp_client_grants",
  );
  if (error) throwRpcError(error);

  const rows = Array.isArray(data) ? data as McpClientGrantRow[] : [];
  return rows.map((row: McpClientGrantRow) => ({
    clientId: row.client_id,
    clientName: row.client_name || "MCP klient",
    clientUri: row.client_uri || null,
    contactsReadExpiresAt: row.contacts_read_expires_at || null,
    writeExpiresAt: row.write_expires_at || null,
  }));
};

export const setMyMcpClientGrant = async (
  clientId: string,
  permission: McpElevatedPermission,
  enabled: boolean,
): Promise<McpGrantMutationResult> => {
  const { data, error } = await dbAdapter.rpc<McpGrantMutationRow[]>(
    "set_my_mcp_client_grant",
    {
      client_id_input: clientId,
      permission_input: permission,
      enabled_input: enabled,
    },
  );
  if (error) throwRpcError(error);
  const rows = Array.isArray(data) ? data as McpGrantMutationRow[] : [];
  const row = rows[0];
  if (!row) throw new Error("Server nevrátil stav MCP oprávnění.");

  return {
    permission: row.permission,
    enabled: row.enabled,
    expiresAt: row.expires_at || null,
  };
};

export const revokeMyMcpClientAccess = async (clientId: string): Promise<void> => {
  const { error } = await dbAdapter.revokeOauthGrant(clientId);
  if (error) throwRpcError(error);
};

import { describe, expect, it, vi } from "vitest";
import { getContractOverview } from "../server/mcp/data.js";
import {
  MCP_OAUTH_SCOPES,
  MCP_PERMISSIONS,
  getMcpToolPolicy,
  getSupportedMcpOAuthScopes,
  hasMcpPermissions,
} from "../server/mcp/scopePolicy.js";
import { MCP_TOOL_CATALOG } from "../shared/mcp/toolCatalog.js";

describe("MCP tool catalog and permissions", () => {
  it("udržuje zobrazovanou matici jako úplný zdroj serverových tool policy", () => {
    const toolNames = MCP_TOOL_CATALOG.map((tool) => tool.name);

    expect(toolNames).toHaveLength(17);
    expect(new Set(toolNames).size).toBe(toolNames.length);
    expect(toolNames).toEqual(expect.arrayContaining([
      "search",
      "fetch",
      "tf_list_projects",
      "tf_list_contacts",
      "tf_prepare_change",
      "tf_confirm_change",
      "tf_execute_change",
    ]));

    for (const tool of MCP_TOOL_CATALOG) {
      expect(getMcpToolPolicy(tool.name)).toEqual({
        requiredPermissions: tool.requiredPermissions,
        riskLevel: tool.riskLevel,
      });
    }
  });

  it("odděluje standardní OAuth scopes od interních oprávnění", () => {
    expect(getSupportedMcpOAuthScopes()).toEqual([
      MCP_OAUTH_SCOPES.identity,
      MCP_OAUTH_SCOPES.email,
      MCP_OAUTH_SCOPES.profile,
    ]);
    expect(getMcpToolPolicy("tf_list_projects").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
    ]);
    expect(getMcpToolPolicy("search").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
    ]);
    expect(getMcpToolPolicy("fetch").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
    ]);
    expect(getMcpToolPolicy("tf_get_project_summary").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
    ]);
    expect(getMcpToolPolicy("tf_list_tasks").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
    ]);
    expect(getMcpToolPolicy("tf_list_contacts").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
      MCP_PERMISSIONS.contactsRead,
    ]);
    expect(getMcpToolPolicy("tf_execute_change").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
      MCP_PERMISSIONS.write,
    ]);

    expect(hasMcpPermissions([MCP_PERMISSIONS.read], [MCP_PERMISSIONS.read])).toBe(true);
    expect(
      hasMcpPermissions(
        [MCP_PERMISSIONS.read],
        [MCP_PERMISSIONS.read, MCP_PERMISSIONS.write],
      ),
    ).toBe(false);
  });

  it("načítá smluvní přehled přes autorizované RPC a minimalizuje dokumentová data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          organization_id: "11111111-1111-4111-8111-111111111111",
          project_id: "project-1",
          project_name: "Administrativní centrum",
          project_status: "active",
          contract_id: "22222222-2222-4222-8222-222222222222",
          contract_partner: "Dodavatel s.r.o.",
          contract_title: "Generální dodávka",
          contract_number: "SOD-001",
          contract_status: "signed",
          currency: "INVALID",
          base_price: "1000",
          current_total: "1100",
          approved_drawdown: "400",
          remaining_amount: "700",
          document_url: "https://private.example/document.pdf",
          document_storage_path: "tenant/private/document.pdf",
          document_file_name: "smlouva.pdf",
          amendments: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              amendment_no: 1,
              delta_price: "100",
              document_storage_path: "tenant/private/amendment.pdf",
              document_file_name: "dodatek.pdf",
            },
          ],
        },
      ],
      error: null,
    });

    const rows = await getContractOverview(
      { rpc } as never,
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        includeArchived: false,
      },
    );

    expect(rpc).toHaveBeenCalledWith("get_contract_overview", {
      organization_id_input: "11111111-1111-4111-8111-111111111111",
      include_archived: false,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        projectId: "project-1",
        contractTitle: "Generální dodávka",
        currency: "CZK",
        currentTotal: 1100,
        hasDocument: true,
        documentFileName: "smlouva.pdf",
        amendments: [
          expect.objectContaining({
            amendmentNo: 1,
            hasDocument: true,
            documentFileName: "dodatek.pdf",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("tenant/private");
    expect(JSON.stringify(rows)).not.toContain("private.example");
  });
});

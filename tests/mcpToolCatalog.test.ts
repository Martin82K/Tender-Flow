import { describe, expect, it, vi } from "vitest";
import { getContractOverview } from "../server/mcp/data.js";
import {
  MCP_SCOPES,
  getLocalSessionMcpScopes,
  getMcpToolPolicy,
  hasMcpScopes,
} from "../server/mcp/scopePolicy.js";

describe("MCP tool catalog and scopes", () => {
  it("odděluje běžné čtení, kontaktní údaje a zápis", () => {
    expect(getMcpToolPolicy("tf_list_projects").requiredScopes).toEqual([
      MCP_SCOPES.read,
    ]);
    expect(getMcpToolPolicy("tf_list_contacts").requiredScopes).toEqual([
      MCP_SCOPES.read,
      MCP_SCOPES.contactsRead,
    ]);
    expect(getMcpToolPolicy("tf_execute_change").requiredScopes).toEqual([
      MCP_SCOPES.read,
      MCP_SCOPES.write,
    ]);

    expect(hasMcpScopes([MCP_SCOPES.read], [MCP_SCOPES.read])).toBe(true);
    expect(
      hasMcpScopes([MCP_SCOPES.read], [MCP_SCOPES.read, MCP_SCOPES.write]),
    ).toBe(false);
  });

  it("běžnému lokálnímu session tokenu neudělí kontaktní scope", () => {
    expect(getLocalSessionMcpScopes([
      "authenticated",
      MCP_SCOPES.contactsRead,
      MCP_SCOPES.write,
    ])).toEqual([
      "authenticated",
      MCP_SCOPES.identity,
      MCP_SCOPES.read,
    ]);
    expect(getLocalSessionMcpScopes([])).not.toContain(MCP_SCOPES.contactsRead);
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

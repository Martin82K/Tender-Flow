import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { MCP_TOOL_CATALOG } from "../shared/mcp/toolCatalog.js";
import { createProposal } from "../server/mcp/tenderFlowMcp.js";

const ROOT = process.cwd();

describe("MCP bid offer update", () => {
  it("publishes a dedicated guarded offer-price preparation tool", () => {
    expect(MCP_TOOL_CATALOG).toContainEqual(expect.objectContaining({
      name: "tf_prepare_bid_offer_update",
      requiredPermissions: [
        "tenderflow.read",
        "tenderflow.write",
        "tenderflow.bids.offer.write",
      ],
      riskLevel: "medium",
      mode: "write",
    }));

    const source = fs.readFileSync(
      path.join(ROOT, "server/mcp/modules/changes.js"),
      "utf8",
    );
    expect(source).toContain("'tf_prepare_bid_offer_update'");
    expect(source).toContain("totalPriceExcludingVat");
    expect(source).toContain("additionalInformation");
    expect(source).toContain("sourceReference");
    expect(source).toContain("currency: z.literal('CZK')");
    expect(source).not.toMatch(
      /const prepareChangeSchema[\s\S]*updateBidOfferProposalSchema,[\s\S]*const confirmChangeSchema/,
    );
  });

  it("uses one narrow RPC for preview and execution", async () => {
    const mcpData = await import("../server/mcp/data.js");
    const changeBidOffer = (mcpData as Record<string, unknown>).changeBidOffer as
      | ((supabase: unknown, input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        tender_id: "tender-1",
        previous_price: "1200000",
        price: "1345000",
        previous_notes: "Původní poznámka",
        notes: "Původní poznámka\n\nCenová nabídka – doplňující informace:\n- Bez dopravy",
        selection_round: 1,
        expected_updated_at: "2026-09-01T12:00:00.000Z",
        changed: false,
      }],
      error: null,
    });

    expect(changeBidOffer).toBeTypeOf("function");
    await expect(changeBidOffer?.({ rpc }, {
      bidId: " bid-1 ",
      totalPriceExcludingVat: 1_345_000,
      notesAppendix: "Cenová nabídka – doplňující informace:\n- Bez dopravy",
      selectionRound: 1,
      expectedUpdatedAt: "2026-09-01T12:00:00.000Z",
      dryRun: true,
    })).resolves.toMatchObject({
      bidId: "bid-1",
      previousPrice: 1_200_000,
      price: 1_345_000,
      selectionRound: 1,
      changed: false,
    });
    expect(rpc).toHaveBeenCalledWith("change_mcp_bid_offer", {
      bid_id_input: "bid-1",
      price_excluding_vat_input: 1_345_000,
      notes_appendix_input: "Cenová nabídka – doplňující informace:\n- Bez dopravy",
      selection_round_input: 1,
      expected_updated_at_input: "2026-09-01T12:00:00.000Z",
      dry_run_input: true,
    });
  });

  it("keeps table writes behind a permission-scoped concurrency-safe RPC", () => {
    const migrationName = fs
      .readdirSync(path.join(ROOT, "supabase/migrations"))
      .find((name) => name.endsWith("_mcp_bid_offer_update.sql"));

    expect(migrationName).toBeDefined();
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations", migrationName as string),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.change_mcp_bid_offer");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("public.mcp_current_user_id()");
    expect(migration).toContain("public.mcp_current_client_id()");
    expect(migration).toContain("public.mcp_has_permission('tenderflow.write')");
    expect(migration).toContain("public.mcp_has_permission('tenderflow.bids.offer.write')");
    expect(migration).toContain("bid_offer_write_expires_at");
    expect(migration).toContain("public.can_project_module_action");
    expect(migration).toContain("Bid changed after the proposal was prepared.");
    expect(migration).toContain("price_history = jsonb_set");
    expect(migration).toContain("bid.updated_at::TEXT");
    expect(migration).toMatch(/CHAR_LENGTH\(combined_notes\) > 10000/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.change_mcp_bid_offer[\s\S]*TO tenderflow_mcp_client/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.change_mcp_bid_offer[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).not.toMatch(/GRANT\s+UPDATE\s+ON(?:\s+TABLE)?\s+public\.bids\s+TO\s+tenderflow_mcp_client/i);
  });

  it("prepares a reviewable diff and preserves the original notes", async () => {
    const proposal = {
      id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2026-09-01T13:00:00.000Z",
      change_type: "update_bid_offer",
    };
    const proposalQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: proposal, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        tender_id: "tender-1",
        previous_price: "1200000",
        price: "1345000",
        previous_notes: "Původní poznámka",
        notes: "Původní poznámka\n\nCenová nabídka – doplňující informace:\n- Cena nezahrnuje dopravu.\n- Pozastávka 5 %.\nZdroj: nabídka-2026-09-01.pdf",
        selection_round: 1,
        expected_updated_at: "2026-09-01T12:00:00.000Z",
        changed: false,
      }],
      error: null,
    });
    const supabase = {
      rpc,
      from: vi.fn().mockReturnValue(proposalQuery),
    };

    await expect(createProposal(supabase as never, {
      userId: "user-1",
      clientId: "client-1",
    }, {
      change: {
        type: "update_bid_offer",
        bidId: "bid-1",
        totalPriceExcludingVat: 1_345_000,
        currency: "CZK",
        additionalInformation: [
          "Cena nezahrnuje dopravu.",
          "Pozastávka 5 %.",
        ],
        sourceReference: "nabídka-2026-09-01.pdf",
      },
    })).resolves.toMatchObject({
      ok: true,
      data: {
        supported: true,
        riskLevel: "high",
        diff: {
          before: {
            bidId: "bid-1",
            totalPriceExcludingVat: 1_200_000,
            notes: "Původní poznámka",
          },
          after: {
            bidId: "bid-1",
            totalPriceExcludingVat: 1_345_000,
            currency: "CZK",
            selectionRound: 1,
          },
        },
      },
    });
    expect(rpc).toHaveBeenCalledWith("change_mcp_bid_offer", expect.objectContaining({
      notes_appendix_input: "Cenová nabídka – doplňující informace:\n- Cena nezahrnuje dopravu.\n- Pozastávka 5 %.\nZdroj: nabídka-2026-09-01.pdf",
      dry_run_input: true,
    }));
    expect(proposalQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      change_type: "update_bid_offer",
      risk_level: "high",
      change_payload: expect.objectContaining({
        type: "update_bid_offer",
        expectedUpdatedAt: "2026-09-01T12:00:00.000Z",
        selectionRound: 1,
      }),
    }));
  });
});

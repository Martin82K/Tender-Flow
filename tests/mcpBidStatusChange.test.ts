import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createProposal,
  executeProposal,
  isExecutionConfirmed,
} from "../server/mcp/tenderFlowMcp.js";

const ROOT = process.cwd();

describe("MCP bid status change", () => {
  it("uses one narrow RPC for dry-run and idempotent status execution", async () => {
    const mcpData = await import("../server/mcp/data.js");
    const changeBidStatus = (mcpData as Record<string, unknown>).changeBidStatus as
      | ((supabase: unknown, input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        tender_id: "tender-1",
        previous_status: "sent",
        status: "offer",
        changed: false,
      }],
      error: null,
    });

    expect(changeBidStatus).toBeTypeOf("function");
    await expect(changeBidStatus?.({ rpc }, {
      bidId: " bid-1 ",
      status: "offer",
      expectedStatus: "sent",
      dryRun: true,
    })).resolves.toEqual({
      bidId: "bid-1",
      projectId: "project-1",
      tenderId: "tender-1",
      previousStatus: "sent",
      status: "offer",
      changed: false,
    });
    expect(rpc).toHaveBeenCalledWith("change_mcp_bid_status", {
      bid_id_input: "bid-1",
      status_input: "offer",
      expected_status_input: "sent",
      dry_run_input: true,
    });
  });

  it("keeps MCP without direct bids UPDATE and grants only an authorized RPC", () => {
    const migrationName = fs
      .readdirSync(path.join(ROOT, "supabase/migrations"))
      .find((name) => name.endsWith("_mcp_bid_status_change.sql"));

    expect(migrationName).toBeDefined();
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations", migrationName as string),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.change_mcp_bid_status");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("public.mcp_current_user_id()");
    expect(migration).toContain("public.mcp_current_client_id()");
    expect(migration).toContain("public.mcp_has_permission('tenderflow.write')");
    expect(migration).toContain("public.can_project_module_action");
    expect(migration).toContain("Bid has an unsupported current status.");
    expect(migration).toMatch(
      /ADD CONSTRAINT bids_status_check[\s\S]*'contacted'[\s\S]*'rejected'/,
    );
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.change_mcp_bid_status[\s\S]*TO tenderflow_mcp_client/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.change_mcp_bid_status[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).not.toMatch(/GRANT\s+UPDATE\s+ON(?:\s+TABLE)?\s+public\.bids\s+TO\s+tenderflow_mcp_client/i);
  });

  it("accepts only a status-only update_bid payload", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "server/mcp/modules/changes.js"),
      "utf8",
    );

    expect(source).toMatch(
      /const updateBidProposalSchema[\s\S]*type: z\.literal\('update_bid'\)[\s\S]*bidId:[\s\S]*status: bidStatusSchema[\s\S]*\.strict\(\)/,
    );
    expect(source).toContain("expectedStatus: preview.previousStatus");
    expect(source).toContain("dryRun: false");
    expect(source).toContain("Only create_task, status-only update_bid, and update_bid_offer execution are enabled in MCP.");
  });

  it("accepts the visible confirmation text and preserves legacy execute tokens", async () => {
    const executeToken = "x".repeat(64);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(executeToken),
    );
    const executeTokenHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const proposal = {
      confirmation_text: "POTVRZUJI MCP ZMĚNU proposal-1: update_bid",
      execute_token_hash: executeTokenHash,
    };

    await expect(isExecutionConfirmed(proposal, {
      confirmationText: proposal.confirmation_text,
    })).resolves.toBe(true);
    await expect(isExecutionConfirmed(proposal, { executeToken })).resolves.toBe(true);
    await expect(isExecutionConfirmed(proposal, {
      confirmationText: "POTVRZUJI JINOU ZMĚNU",
    })).resolves.toBe(false);
  });

  it("prepares an authoritative before/after status diff", async () => {
    const proposal = {
      id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2026-08-09T23:00:00.000Z",
      change_type: "update_bid",
    };
    const proposalQuery = {
      error: null,
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
        previous_status: "sent",
        status: "offer",
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
        type: "update_bid",
        payload: { bidId: "bid-1", status: "offer" },
      },
    })).resolves.toMatchObject({
      ok: true,
      data: {
        supported: true,
        riskLevel: "high",
        diff: {
          before: { bidId: "bid-1", status: "sent" },
          after: { bidId: "bid-1", status: "offer" },
        },
      },
    });
    expect(proposalQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      change_payload: {
        type: "update_bid",
        payload: {
          bidId: "bid-1",
          status: "offer",
          expectedStatus: "sent",
        },
      },
    }));
  });

  it("executes only the confirmed status and records a bid result", async () => {
    const confirmationText =
      "POTVRZUJI MCP ZMĚNU 11111111-1111-4111-8111-111111111111: update_bid";
    const proposal = {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      client_id: "client-1",
      status: "confirmed",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      confirmation_text: confirmationText,
      execute_token_hash: null,
      change_type: "update_bid",
      change_payload: {
        type: "update_bid",
        payload: {
          bidId: "bid-1",
          status: "offer",
          expectedStatus: "sent",
        },
      },
    };
    const proposalQuery = {
      error: null,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: proposal, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    const idempotencyQuery = {
      error: null,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        tender_id: "tender-1",
        previous_status: "sent",
        status: "offer",
        changed: true,
      }],
      error: null,
    });
    const supabase = {
      rpc,
      from: vi.fn((table: string) => (
        table === "mcp_change_proposals" ? proposalQuery : idempotencyQuery
      )),
    };

    await expect(executeProposal(supabase as never, {
      userId: "user-1",
      clientId: "client-1",
    }, {
      proposalId: proposal.id,
      confirmationText,
      idempotencyKey: "outlook-reply-bid-1",
    })).resolves.toEqual({
      ok: true,
      data: {
        proposalId: proposal.id,
        status: "executed",
        bid: {
          bidId: "bid-1",
          projectId: "project-1",
          tenderId: "tender-1",
          previousStatus: "sent",
          status: "offer",
          changed: true,
        },
      },
    });
    expect(rpc).toHaveBeenCalledWith("change_mcp_bid_status", {
      bid_id_input: "bid-1",
      status_input: "offer",
      expected_status_input: "sent",
      dry_run_input: false,
    });
    expect(supabase.from).not.toHaveBeenCalledWith("tasks");
    expect(idempotencyQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      proposal_id: proposal.id,
    }));
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { redactForAudit } from "../server/mcp/audit.js";
import {
  linkOutlookMessage,
  matchOutlookReply,
} from "../server/mcp/data.js";
import {
  MCP_PERMISSIONS,
  getMcpToolPolicy,
} from "../server/mcp/scopePolicy.js";
import { MCP_TOOL_CATALOG } from "../shared/mcp/toolCatalog.js";

const ROOT = process.cwd();

const readOutlookMigration = () => {
  const migrationName = fs
    .readdirSync(path.join(ROOT, "supabase/migrations"))
    .find((name) => name.endsWith("_mcp_outlook_message_links.sql"));

  expect(migrationName).toBeDefined();
  return fs.readFileSync(
    path.join(ROOT, "supabase/migrations", migrationName as string),
    "utf8",
  );
};

describe("MCP Outlook message links", () => {
  it("publikuje oddělené read a write tool policy", () => {
    expect(MCP_TOOL_CATALOG.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "tf_link_outlook_message",
        "tf_match_outlook_reply",
      ]),
    );
    expect(getMcpToolPolicy("tf_link_outlook_message").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
      MCP_PERMISSIONS.write,
    ]);
    expect(getMcpToolPolicy("tf_match_outlook_reply").requiredPermissions).toEqual([
      MCP_PERMISSIONS.read,
      MCP_PERMISSIONS.contactsRead,
    ]);
  });

  it("posílá do link RPC pouze explicitní Outlook identifikátory a bid", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        tender_id: "tender-1",
        linked: true,
      }],
      error: null,
    });

    await expect(linkOutlookMessage({ rpc } as never, {
      bidId: " bid-1 ",
      outlookImmutableId: " AAMk-message-1 ",
      internetMessageId: " <outbound@example.test> ",
      conversationId: " conversation-1 ",
    })).resolves.toEqual({
      bidId: "bid-1",
      projectId: "project-1",
      tenderId: "tender-1",
      linked: true,
    });

    expect(rpc).toHaveBeenCalledWith("link_mcp_outlook_message", {
      bid_id_input: "bid-1",
      outlook_immutable_id_input: "AAMk-message-1",
      internet_message_id_input: "<outbound@example.test>",
      conversation_id_input: "conversation-1",
    });
  });

  it("páruje odpověď přes In-Reply-To nebo conversationId bez obsahu emailu", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        bid_id: "bid-1",
        project_id: "project-1",
        project_name: "Stavba A",
        tender_id: "tender-1",
        tender_title: "Elektroinstalace",
        company_name: "Dodavatel s.r.o.",
        bid_status: "sent",
        match_type: "in_reply_to",
      }],
      error: null,
    });

    await expect(matchOutlookReply({ rpc } as never, {
      outlookImmutableId: "incoming-immutable-id",
      internetMessageId: "<incoming@example.test>",
      inReplyToInternetMessageId: "<outbound@example.test>",
      conversationId: "conversation-1",
    })).resolves.toEqual([
      {
        bidId: "bid-1",
        projectId: "project-1",
        projectName: "Stavba A",
        tenderId: "tender-1",
        tenderTitle: "Elektroinstalace",
        companyName: "Dodavatel s.r.o.",
        bidStatus: "sent",
        matchType: "in_reply_to",
      },
    ]);

    expect(rpc).toHaveBeenCalledWith("match_mcp_outlook_reply", {
      outlook_immutable_id_input: "incoming-immutable-id",
      internet_message_id_input: "<incoming@example.test>",
      in_reply_to_internet_message_id_input: "<outbound@example.test>",
      conversation_id_input: "conversation-1",
    });
  });

  it("rediguje Outlook identifikátory z auditního payloadu", () => {
    const redacted = redactForAudit({
      outlookImmutableId: "AAMk-sensitive",
      internetMessageId: "<sensitive@example.test>",
      inReplyToInternetMessageId: "<parent@example.test>",
      conversationId: "conversation-sensitive",
      bidId: "bid-1",
    });

    expect(JSON.stringify(redacted)).not.toContain("AAMk-sensitive");
    expect(JSON.stringify(redacted)).not.toContain("sensitive@example.test");
    expect(JSON.stringify(redacted)).not.toContain("parent@example.test");
    expect(JSON.stringify(redacted)).not.toContain("conversation-sensitive");
    expect(JSON.stringify(redacted)).toContain("bid-1");
  });

  it("řadí Outlook link mezi fail-closed pre-audit zápisy", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "server/mcp/tenderFlowMcp.js"),
      "utf8",
    );

    expect(source).toMatch(/WRITE_AUDIT_ACTIONS[\s\S]*'link_outlook_message'/);
    expect(source).toContain(
      "withAudit(auth, supabase, 'tf_link_outlook_message', 'link_outlook_message'",
    );
  });

  it("ukládá vazby v privátním schématu přes úzce grantovaná RPC", () => {
    const migration = readOutlookMigration();

    expect(migration).toContain("CREATE TABLE mcp_private.outlook_message_links");
    expect(migration).toContain("REFERENCES public.bids(id) ON DELETE CASCADE");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toMatch(/REVOKE ALL ON TABLE mcp_private\.outlook_message_links[\s\S]*FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client/);
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.link_mcp_outlook_message");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.match_mcp_outlook_reply");
    expect(migration.match(/SECURITY DEFINER/g)).toHaveLength(2);
    expect(migration.match(/SET search_path = ''/g)).toHaveLength(2);
    expect(migration.match(/public\.mcp_current_user_id\(\)/g)).toHaveLength(2);
    expect(migration.match(/public\.mcp_current_client_id\(\)/g)).toHaveLength(2);
    expect(migration).not.toContain("auth.jwt()");
    expect(migration).toContain("public.mcp_has_permission('tenderflow.write')");
    expect(migration).toContain("public.mcp_has_permission('tenderflow.contacts.read')");
    expect(migration).toContain("public.can_project_module_action");
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.link_mcp_outlook_message[\s\S]*TO tenderflow_mcp_client/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.match_mcp_outlook_reply[\s\S]*TO tenderflow_mcp_client/);
    expect(migration).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE mcp_private\.outlook_message_links/);
    expect(migration).not.toMatch(/^\s+(message_body|body_html|body_text|attachment_data|subject|recipients?)\s+[A-Z]/im);
    expect(migration).toContain("WHERE existing_link.bid_id = EXCLUDED.bid_id");
    expect(migration).toContain("LIMIT 10");
  });
});

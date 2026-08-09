import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MCP_DOCS = path.join(ROOT, "docs", "mcp");

const requiredDocuments = [
  "README.md",
  "architecture.md",
  "authentication.md",
  "scopes-and-permissions.md",
  "tools-reference.md",
  "resources-reference.md",
  "transports.md",
  "write-safety.md",
  "errors-and-limits.md",
  "security-model.md",
  "operations-runbook.md",
  "testing-and-evals.md",
  "skills.md",
  "client-onboarding.md",
  "troubleshooting.md",
  "release-and-deprecation.md",
  "changelog.md",
  "adr/0001-mcp-2026-07-28.md",
];

const toolNames = [
  "search",
  "fetch",
  "tf_list_projects",
  "tf_get_project_summary",
  "tf_get_project_detail",
  "tf_list_tenders",
  "tf_list_bids",
  "tf_list_winners",
  "tf_list_contracts",
  "tf_get_contract_overview",
  "tf_list_tender_plan",
  "tf_list_contacts",
  "tf_list_upcoming_deadlines",
  "tf_list_tasks",
  "tf_prepare_change",
  "tf_confirm_change",
  "tf_execute_change",
];

const resourceUris = [
  "tenderflow://catalog",
  "tenderflow://projects/{projectId}",
  "tenderflow://tasks/open",
  "tenderflow://organizations/{organizationId}/contracts/overview",
];

const read = (relativePath: string) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");

describe("MCP documentation contract", () => {
  it("publishes the complete documentation foundation", () => {
    for (const document of requiredDocuments) {
      expect(fs.existsSync(path.join(MCP_DOCS, document)), document).toBe(true);
    }
  });

  it("keeps the documented protocol, tools and resources aligned with implementation", () => {
    const serverSource = read("server/mcp/tenderFlowMcp.js");
    const policySource = read("server/mcp/scopePolicy.js");
    const toolsReference = read("docs/mcp/tools-reference.md");
    const resourcesReference = read("docs/mcp/resources-reference.md");
    const architecture = read("docs/mcp/architecture.md");

    expect(serverSource).toContain("protocolVersion: '2026-07-28'");
    expect(architecture).toContain("`2026-07-28`");

    for (const toolName of toolNames) {
      expect(policySource, `${toolName} scope policy`).toContain(`${toolName}:`);
      expect(serverSource, `${toolName} registration`).toContain(`'${toolName}'`);
      expect(toolsReference, `${toolName} documentation`).toContain(`\`${toolName}\``);
    }

    for (const uri of resourceUris) {
      expect(serverSource, `${uri} implementation`).toContain(uri);
      expect(resourcesReference, `${uri} documentation`).toContain(`\`${uri}\``);
    }
  });

  it("labels current limitations and contains no documentation placeholders", () => {
    const combined = requiredDocuments.map((document) => read(`docs/mcp/${document}`)).join("\n");

    expect(combined).toContain("Pouze `create_task`");
    expect(combined).toContain("desktop MCP");
    expect(combined).toContain("in-memory");
    expect(combined).not.toMatch(/\b(?:TODO|TBD|FIXME)\b/);
    expect(combined).not.toMatch(/(?:service[_-]?role|access[_-]?token)\s*[:=]\s*[A-Za-z0-9._-]{16,}/i);
  });
});

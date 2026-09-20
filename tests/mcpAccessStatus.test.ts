import { describe, expect, it, vi } from "vitest";
import { MCP_ACCESS_INSTRUCTIONS, registerDiscoveryModule } from "../server/mcp/modules/discovery.js";

const getStatus = async (permissions: string[], includeWriteTools = true) => {
  const register = vi.fn();
  registerDiscoveryModule({
    auth: { clientId: "client-1", permissions, token: "never-expose-token" },
    supabase: {},
    includeWriteTools,
    tools: { register },
    resources: { register: vi.fn() },
  });
  const registration = register.mock.calls.find(([name]) => name === "tf_get_access_status");
  expect(registration).toBeDefined();
  expect(registration?.[1].annotations.readOnlyHint).toBe(true);
  return registration?.[2]({});
};

describe("MCP access recovery", () => {
  it("explains missing write permission to read-only clients without granting it", async () => {
    const result = await getStatus(["tenderflow.read"]);
    expect(result.data).toMatchObject({
      clientId: "client-1",
      writeEnabled: false,
      financialWriteEnabled: false,
      missingWritePermissions: ["tenderflow.write"],
      settingsUrl: "https://www.tenderflow.cz/app/settings?tab=tools&subTab=mcp",
    });
    expect(result.data.nextSteps.join(" ")).toContain("Zápisové operace");
    expect(JSON.stringify(result)).not.toContain("never-expose-token");
  });

  it("separates financial and contact access from the general write grant", async () => {
    const result = await getStatus(["tenderflow.read", "tenderflow.write"]);
    expect(result.data).toMatchObject({
      writeEnabled: true, financialWriteEnabled: false, contactsEnabled: false,
      missingWritePermissions: [],
      missingFinancialWritePermissions: ["tenderflow.bids.offer.write"],
    });
  });

  it("reports the local read-only switch even with complete grants", async () => {
    const result = await getStatus([
      "tenderflow.read", "tenderflow.write", "tenderflow.contacts.read", "tenderflow.bids.offer.write",
    ], false);
    expect(result.data).toMatchObject({ writeEnabled: false, financialWriteEnabled: false, writeToolsDisabled: true });
    expect(result.data.nextSteps.join(" ")).not.toContain("samostatný finanční zápis");
  });

  it("returns the executable change identifier for bid status updates", async () => {
    const result = await getStatus(["tenderflow.read"]);
    expect(result.data.supportedWriteOperations).toContain("update_bid");
    expect(result.data.supportedWriteOperations).not.toContain("update_bid_status");
  });

  it("asks only for general write when the financial grant already exists", async () => {
    const result = await getStatus(["tenderflow.read", "tenderflow.bids.offer.write"]);
    expect(result.data.financialWriteEnabled).toBe(false);
    expect(result.data.nextSteps.join(" ")).toContain("Zápisové operace");
    expect(result.data.nextSteps.join(" ")).not.toContain("samostatný finanční zápis");
  });

  it("explains that local stdio permissions require restarting the process", async () => {
    const result = await getStatus(["tenderflow.read"]);
    expect(result.data.nextSteps.join(" ")).toMatch(/stdio.*restartujte/);
    expect(MCP_ACCESS_INSTRUCTIONS).toMatch(/stdio.*restart/);
  });
});

it('diagnoses comparison writes independently of bid financial writes',async()=>{
 const financial=['tenderflow.read','tenderflow.write','tenderflow.bids.offer.write'];
 const missing=await getStatus(financial);expect(missing.data).toMatchObject({financialWriteEnabled:true,comparisonWriteEnabled:false,missingComparisonWritePermissions:['tenderflow.contacts.read']});
 expect(missing.data.supportedWriteOperations).toContain('save_offer_comparison');
 expect((await getStatus([...financial,'tenderflow.contacts.read'])).data.comparisonWriteEnabled).toBe(true);
 expect((await getStatus([...financial,'tenderflow.contacts.read'],false)).data.comparisonWriteEnabled).toBe(false);
 expect((await getStatus(['tenderflow.contacts.read'])).data.missingComparisonWritePermissions).not.toContain('tenderflow.contacts.read');
});

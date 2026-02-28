import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import {
  ensureManualCitationInReply,
  formatManualContextForPrompt,
  loadManualIndex,
  retrieveManualSections,
  toManualCitations,
} from "@app/agent/manualKnowledge";

const baseRuntime: AgentRuntimeSnapshot = {
  pathname: "/app",
  search: "",
  currentView: "dashboard",
  selectedProjectId: null,
  projects: [],
  projectDetails: {},
  contacts: [],
  audience: "internal",
  contextScopes: ["manual"],
  contextPolicyVersion: "v1-strict-allowlist",
  isAdmin: false,
};

describe("manual knowledge retriever", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entries: [
            {
              slug: "navigace-v-aplikaci",
              title: "Navigace v aplikaci",
              content: "Sidebar obsahuje Dashboard, Stavby a Nastavení.",
              keywords: ["navigace", "sidebar", "dashboard"],
              source_anchor: "#navigace-v-aplikaci",
              level: 2,
            },
            {
              slug: "sprava-uzivatelu-a-roli",
              title: "Správa uživatelů a rolí",
              content: "Admin může přidávat role a oprávnění.",
              keywords: ["admin", "role", "opravneni"],
              source_anchor: "#sprava-uzivatelu-a-roli",
              level: 2,
            },
          ],
        }),
      }),
    );
  });

  it("vraci relevantni sekce z prirucky", async () => {
    await loadManualIndex(true);
    const sections = await retrieveManualSections("kde najdu dashboard v navigaci", baseRuntime);

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].anchor).toBe("#navigace-v-aplikaci");

    const promptContext = formatManualContextForPrompt(sections);
    expect(promptContext).toContain("MANUAL CONTEXT");
    expect(promptContext).toContain("#navigace-v-aplikaci");
  });

  it("pro ne-admin uzivatele odfiltruje admin sekce", async () => {
    await loadManualIndex(true);
    const sections = await retrieveManualSections("jak funguje sprava roli admin", baseRuntime);

    expect(sections.some((item) => item.anchor === "#sprava-uzivatelu-a-roli")).toBe(false);
  });

  it("doplni citaci kdyz v odpovedi chybi", () => {
    const citations = toManualCitations([
      {
        title: "Navigace v aplikaci",
        anchor: "#navigace-v-aplikaci",
        content: "...",
        confidence: 0.9,
      },
    ]);

    const withCitation = ensureManualCitationInReply("Otevři sidebar a klikni na Dashboard.", citations);
    expect(withCitation.emitted).toBe(true);
    expect(withCitation.text).toContain("Zdroj: Navigace v aplikaci (#navigace-v-aplikaci)");
  });
});

import { describe, expect, it } from "vitest";
import { extractManualKbEntries } from "../scripts/user-manual-kb.mjs";

describe("user manual kb builder", () => {
  it("chunkuje H2/H3 sekce a vytvori anchory", () => {
    const markdown = [
      "## Navigace v aplikaci",
      "Sidebar obsahuje hlavní moduly.",
      "### Dashboard",
      "Dashboard ukazuje přehled.",
      "## Výběrová řízení",
      "Pipeline workflow.",
    ].join("\n");

    const entries = extractManualKbEntries(markdown);
    const anchors = entries.map((entry) => entry.source_anchor);

    expect(entries.length).toBe(3);
    expect(anchors).toContain("#navigace-v-aplikaci");
    expect(anchors).toContain("#dashboard");
    expect(anchors).toContain("#vyberova-rizeni");
  });

  it("odstrani skodlivy html obsah", () => {
    const markdown = [
      "## Bezpečnost",
      "<script>alert('x')</script>",
      "Text po scriptu.",
    ].join("\n");

    const entries = extractManualKbEntries(markdown);

    expect(entries[0].content).not.toContain("<script>");
    expect(entries[0].content).toContain("Text po scriptu");
  });
});

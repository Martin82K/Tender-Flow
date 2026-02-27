import { describe, expect, it } from "vitest";
import { buildBccRecipientList } from "../features/projects/model/pipelineEmailModel";

describe("buildBccRecipientList", () => {
  it("joins emails with semicolon", () => {
    expect(buildBccRecipientList(["a@x.cz", "b@x.cz"])).toBe("a@x.cz;b@x.cz");
  });

  it("ignores empty values, trims values and deduplicates", () => {
    expect(
      buildBccRecipientList([
        " a@x.cz ",
        "",
        "   ",
        "a@x.cz",
        "b@x.cz",
        "b@x.cz",
      ]),
    ).toBe("a@x.cz;b@x.cz");
  });
});

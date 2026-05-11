import { describe, expect, it } from "vitest";
import { splitIndustrialProjectTitle } from "@/shared/ui/brandedTitle";

describe("splitIndustrialProjectTitle", () => {
  it("zachová ruční branding pro REKO Bazén Aš", () => {
    expect(splitIndustrialProjectTitle("REKO Bazén Aš")).toEqual([
      { text: "REKO ", variant: "default" },
      { text: "Bazén", variant: "script" },
      { text: " Aš", variant: "default" },
    ]);
  });

  it("zvýrazní typ stavby i u ostatních číslovaných projektů", () => {
    expect(splitIndustrialProjectTitle("25036 Statické zajištění silnice Oloví - Boučí, 2.etapa")).toEqual([
      { text: "25036 ", variant: "default" },
      { text: "Statické zajištění silnice", variant: "script" },
      { text: " Oloví - Boučí, 2.etapa", variant: "default" },
    ]);
  });
});

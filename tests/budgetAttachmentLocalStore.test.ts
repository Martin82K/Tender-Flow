import { beforeEach, describe, expect, it } from "vitest";
import {
  applyLocalBudgetAttachments,
  getLocalBudgetAttachment,
  saveLocalBudgetAttachment,
} from "@/features/projects/model/budgetAttachmentLocalStore";
import type { DemandCategory } from "@/types";

const storageKey = "tender-flow:budget-attachments:v1";

const category: DemandCategory = {
  id: "cat-1",
  title: "Elektro",
  budget: "0 Kč",
  sodBudget: 0,
  planBudget: 0,
  status: "open",
  subcontractorCount: 0,
  description: "",
};

describe("budgetAttachmentLocalStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uloží a načte lokální mapování přílohy mimo Supabase", () => {
    const attachment = {
      source: "dochub" as const,
      fileName: "rozpocet.xlsx",
      relativePath: "rozpocet.xlsx",
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    };

    saveLocalBudgetAttachment("project-1", "cat-1", attachment);

    expect(getLocalBudgetAttachment("project-1", "cat-1")).toEqual(attachment);
    expect(applyLocalBudgetAttachments("project-1", [category])[0].budgetAttachment).toEqual(
      attachment,
    );
  });

  it("odpojení přílohy odstraní lokální mapování", () => {
    saveLocalBudgetAttachment("project-1", "cat-1", {
      source: "dochub",
      fileName: "rozpocet.xlsx",
      relativePath: "rozpocet.xlsx",
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    });

    saveLocalBudgetAttachment("project-1", "cat-1", null);

    expect(getLocalBudgetAttachment("project-1", "cat-1")).toBeNull();
    expect(applyLocalBudgetAttachments("project-1", [category])[0].budgetAttachment).toBeUndefined();
  });

  it("ignoruje poškozené lokální mapování", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        "project-1": {
          "cat-1": {
            source: "dochub",
            relativePath: "rozpocet.xlsx",
            selectedAt: "2026-07-01T20:00:00.000Z",
            enabled: true,
          },
        },
      }),
    );

    expect(getLocalBudgetAttachment("project-1", "cat-1")).toBeNull();
    expect(applyLocalBudgetAttachments("project-1", [category])[0].budgetAttachment).toBeUndefined();
  });
});

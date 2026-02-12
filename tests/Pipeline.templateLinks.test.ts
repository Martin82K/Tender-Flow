import { describe, expect, it } from "vitest";
import { getTemplateLinksForInquiryKind } from "../components/Pipeline";
import type { ProjectDetails } from "../types";

const createProject = (overrides: Partial<ProjectDetails>): ProjectDetails =>
  ({
    id: "proj-1",
    title: "Test",
    location: "Praha",
    finishDate: "2026-12-31",
    siteManager: "Manager",
    categories: [],
    ...overrides,
  }) as ProjectDetails;

describe("getTemplateLinksForInquiryKind", () => {
  it("uses material template first and inquiry template as second fallback", () => {
    const project = createProject({
      materialInquiryTemplateLink: "template:material",
      inquiryLetterLink: "template:inquiry",
    });

    expect(getTemplateLinksForInquiryKind(project, "materialInquiry")).toEqual([
      "template:material",
      "template:inquiry",
    ]);
  });

  it("falls back to inquiry template when material template is not set", () => {
    const project = createProject({
      inquiryLetterLink: "template:inquiry",
    });

    expect(getTemplateLinksForInquiryKind(project, "materialInquiry")).toEqual([
      "template:inquiry",
    ]);
  });

  it("returns only inquiry template for standard inquiry generation", () => {
    const project = createProject({
      inquiryLetterLink: "template:inquiry",
      materialInquiryTemplateLink: "template:material",
    });

    expect(getTemplateLinksForInquiryKind(project, "inquiry")).toEqual([
      "template:inquiry",
    ]);
  });
});
